import { createClient, configure, type Client } from "tdl";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "fs";
import { resolve } from "path";
import type { TelegramCommand } from "@prisma/client";
import type { TelegramAuthState } from "@/types/config";
import { logger } from "../logger";
import { getSettings, getTelegramChannels } from "../config";
import {
  claimNextTelegramCommand,
  completeTelegramCommand,
  failTelegramCommand,
  markTelegramWorkerHeartbeat,
  updateTelegramRuntimeState,
} from "./client";
import { scanChannel, scanChannelPrevious } from "./scanner";
import { resolveChannelInfo } from "./channel-info";
import { processNextIpa } from "../pipeline/orchestrator";

type PendingInputRequest = {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
};

const CONNECT_TRANSITION_TIMEOUT_MS = 5_000;
const CONNECT_RETRY_DELAY_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function ensureTdlibConfigured(): Promise<void> {
  try {
    const { getTdjson } = await import("prebuilt-tdlib");
    configure({ tdjson: getTdjson() });
  } catch {
    // Fall back to system TDLib when prebuilt binaries are unavailable.
  }
}

function getDbDir(): string {
  return resolve(process.cwd(), "tdlib-data/db");
}

function getFilesDir(): string {
  return resolve(process.cwd(), "tdlib-data/files");
}

function hasPersistedSession(): boolean {
  try {
    return existsSync(getDbDir()) && readdirSync(getDbDir()).length > 0;
  } catch {
    return false;
  }
}

function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class TelegramService {
  private client: Client | null = null;
  private ready = false;
  private currentState: TelegramAuthState = "disconnected";
  private passwordHint = "";
  private pendingCodeRequest: PendingInputRequest | null = null;
  private pendingPasswordRequest: PendingInputRequest | null = null;
  private reconnectPromise: Promise<Client> | null = null;
  private interactiveLoginPromise: Promise<void> | null = null;
  private shuttingDown = false;
  private readonly owner = `${process.pid}@${process.env.HOSTNAME ?? "ftrepo-worker"}`;
  private readonly chatIdMap = new Map<string, number>();

  async start(): Promise<void> {
    await ensureTdlibConfigured();
    await markTelegramWorkerHeartbeat(this.owner);

    const runtime = await updateTelegramRuntimeState({
      owner: this.owner,
      currentCommandId: null,
      error: null,
    });

    this.currentState = runtime.state as TelegramAuthState;
    this.passwordHint = runtime.passwordHint;

    if (this.shouldAttemptAutoResume(runtime)) {
      try {
        await this.ensureOperationalClient();
      } catch (error) {
        await logger.warn(
          "system",
          "Telegram session was found but could not be resumed automatically",
          { error: extractErrorMessage(error) }
        );
      }
    }
  }

  async stop(): Promise<void> {
    this.shuttingDown = true;
    this.rejectPendingInputs("Telegram worker is shutting down.");
    await this.closeClient();
    await updateTelegramRuntimeState({
      owner: this.owner,
      currentCommandId: null,
      lastHeartbeatAt: new Date(),
    });
  }

  async heartbeat(): Promise<void> {
    await markTelegramWorkerHeartbeat(this.owner);
  }

  async processNextCommand(): Promise<boolean> {
    const command = await claimNextTelegramCommand(this.owner);
    if (!command) {
      return false;
    }

    try {
      const result = await this.executeCommand(command);
      await completeTelegramCommand(command.id, result);
    } catch (error) {
      await failTelegramCommand(command.id, extractErrorMessage(error));
    }

    return true;
  }

  async scanConfiguredChannels(messageLimit: number): Promise<void> {
    const channels = await getTelegramChannels();
    if (channels.length === 0) {
      await logger.warn("system", "No Telegram channels configured. Scan skipped.");
      return;
    }

    let scanned = 0;
    const client = await this.ensureOperationalClient();
    for (const channelId of channels) {
      await scanChannel(client, channelId, messageLimit);
      scanned++;
      if (!this.chatIdMap.has(channelId)) {
        await this.resolveChatId(channelId);
      }
    }

    await logger.info("scan", `Worker scan finished across ${scanned} channel(s)`);
  }

  async processNextQueuedIpa(): Promise<boolean> {
    if (!this.ready) {
      try {
        await this.ensureOperationalClient();
      } catch {
        return false;
      }
    }

    if (!this.client) {
      return false;
    }

    return processNextIpa(this.chatIdMap, this.client);
  }

  private shouldAttemptAutoResume(runtime: {
    state: string;
    sessionReady: boolean;
    lastAuthAt: Date | null;
    lastConnectedAt: Date | null;
  }): boolean {
    if (!hasPersistedSession()) {
      return false;
    }

    return (
      runtime.sessionReady ||
      runtime.state === "ready" ||
      runtime.state === "connecting" ||
      runtime.state === "error" ||
      (runtime.state === "disconnected" &&
        runtime.lastAuthAt === null &&
        runtime.lastConnectedAt === null)
    );
  }

  private async executeCommand(
    command: TelegramCommand
  ): Promise<Record<string, unknown> | undefined> {
    const payload = (command.payload ?? {}) as Record<string, unknown>;

    switch (command.type) {
      case "connect":
        await this.handleConnectCommand();
        return { state: this.currentState };
      case "submit_code":
        await this.handleCodeCommand(String(payload.code ?? ""));
        return { state: this.currentState };
      case "submit_password":
        await this.handlePasswordCommand(String(payload.password ?? ""));
        return { state: this.currentState };
      case "disconnect":
        await this.handleDisconnectCommand();
        return { state: this.currentState };
      case "reset_session":
        await this.handleResetCommand();
        return { state: this.currentState };
      case "scan_now": {
        const settings = await getSettings();
        await this.scanConfiguredChannels(settings.scan_message_limit);
        return { state: this.currentState };
      }
      case "scan_previous": {
        const client = await this.ensureOperationalClient();
        const settings = await getSettings();
        const channels = await getTelegramChannels();
        for (const channelId of channels) {
          await scanChannelPrevious(client, channelId, settings.previous_ipa_scan_amount);
        }
        return { state: this.currentState };
      }
      case "refresh_topics": {
        const channelId = String(payload.channelId ?? "");
        if (!channelId) {
          throw new Error("channelId is required");
        }
        const client = await this.ensureOperationalClient();
        await resolveChannelInfo(channelId, client);
        return { state: this.currentState, channelId };
      }
      case "process_queue": {
        let processed = 0;
        while (!this.shuttingDown && (await this.processNextQueuedIpa())) {
          processed++;
        }
        return { state: this.currentState, processed };
      }
      default:
        throw new Error(`Unsupported Telegram command: ${command.type}`);
    }
  }

  private async handleConnectCommand(): Promise<void> {
    if (this.ready && this.client) {
      await this.setState("ready", null, {
        sessionReady: true,
        lastConnectedAt: new Date(),
      });
      return;
    }

    await this.closeClient();
    this.rejectPendingInputs("Telegram authentication was restarted.");

    const settings = await getSettings();
    this.client = await this.createClient(settings.telegram_api_id, settings.telegram_api_hash);
    this.attachClientErrorHandler(this.client);

    await this.setState("connecting", null, {
      sessionReady: false,
      passwordHint: "",
    });

    this.interactiveLoginPromise = this.client
      .login({
        getPhoneNumber: async (retry) => {
          if (retry) {
            throw new Error("Invalid phone number");
          }
          return settings.telegram_phone;
        },
        getAuthCode: async (retry) => {
          await this.setState("waiting_code", retry ? "Invalid code, please try again." : null, {
            passwordHint: "",
          });
          return new Promise<string>((resolvePromise, rejectPromise) => {
            this.pendingCodeRequest = {
              resolve: resolvePromise,
              reject: rejectPromise,
            };
          });
        },
        getPassword: async (hint, retry) => {
          this.passwordHint = hint;
          await this.setState(
            "waiting_password",
            retry ? "Invalid password, please try again." : null,
            { passwordHint: hint }
          );
          return new Promise<string>((resolvePromise, rejectPromise) => {
            this.pendingPasswordRequest = {
              resolve: resolvePromise,
              reject: rejectPromise,
            };
          });
        },
        confirmOnAnotherDevice: async (link) => {
          await this.setState(
            "error",
            `Confirm the Telegram login on another device: ${link}`,
            {
              sessionReady: false,
            }
          );
          throw new Error(`Confirm the Telegram login on another device: ${link}`);
        },
      })
      .then(async () => {
        this.ready = true;
        await this.setState("ready", null, {
          sessionReady: true,
          passwordHint: "",
          retryCount: 0,
          lastConnectedAt: new Date(),
          lastAuthAt: new Date(),
        });
        await logger.success("system", "Telegram session authenticated");
      })
      .catch(async (error) => {
        const message = extractErrorMessage(error);

        if (message.includes("Telegram connection was closed")) {
          return;
        }

        this.ready = false;
        this.rejectPendingInputs(message);
        await this.closeClient();
        await this.handleConnectionFailure(message, false);
        await logger.error("system", "Telegram authentication failed", {
          error: message,
        });
      })
      .finally(() => {
        this.interactiveLoginPromise = null;
      });

    await this.waitForStateTransition("connecting");
  }

  private async handleCodeCommand(code: string): Promise<void> {
    if (this.currentState !== "waiting_code" || !this.pendingCodeRequest) {
      throw new Error("Telegram is not waiting for a verification code.");
    }
    const request = this.pendingCodeRequest;
    this.pendingCodeRequest = null;
    request.resolve(code);
    await this.waitForStateTransition("waiting_code");
  }

  private async handlePasswordCommand(password: string): Promise<void> {
    if (this.currentState !== "waiting_password" || !this.pendingPasswordRequest) {
      throw new Error("Telegram is not waiting for a 2FA password.");
    }
    const request = this.pendingPasswordRequest;
    this.pendingPasswordRequest = null;
    request.resolve(password);
    await this.waitForStateTransition("waiting_password");
  }

  private async handleDisconnectCommand(): Promise<void> {
    this.rejectPendingInputs("Telegram was disconnected.");
    await this.closeClient();
    this.ready = false;
    await this.setState("disconnected", null, {
      sessionReady: false,
      passwordHint: "",
      currentCommandId: null,
    });
    await logger.info("system", "Telegram connection closed by user");
  }

  private async handleResetCommand(): Promise<void> {
    this.rejectPendingInputs("Telegram session was reset.");
    await this.closeClient();
    this.ready = false;

    rmSync(getDbDir(), { recursive: true, force: true });
    rmSync(getFilesDir(), { recursive: true, force: true });

    await this.setState("disconnected", null, {
      sessionReady: false,
      passwordHint: "",
      retryCount: 0,
      lastConnectedAt: null,
      lastAuthAt: null,
    });
    await logger.warn("system", "Telegram session data was reset");
  }

  private async ensureOperationalClient(): Promise<Client> {
    if (this.ready && this.client) {
      return this.client;
    }

    if (
      this.currentState === "waiting_code" ||
      this.currentState === "waiting_password"
    ) {
      throw new Error(
        "Telegram authentication is waiting for input in Settings -> Integrations."
      );
    }

    if (this.reconnectPromise) {
      return this.reconnectPromise;
    }

    this.reconnectPromise = this.resumeExistingSession();
    try {
      return await this.reconnectPromise;
    } finally {
      this.reconnectPromise = null;
    }
  }

  private async resumeExistingSession(): Promise<Client> {
    const settings = await getSettings();
    const client = await this.createClient(settings.telegram_api_id, settings.telegram_api_hash);

    this.attachClientErrorHandler(client);
    this.client = client;
    await this.setState("connecting", null, {
      passwordHint: "",
    });

    try {
      await client.login({
        getPhoneNumber: async () => settings.telegram_phone,
        getAuthCode: async () => {
          throw new Error("INTERACTIVE_AUTH_REQUIRED");
        },
        getPassword: async () => {
          throw new Error("INTERACTIVE_AUTH_REQUIRED");
        },
        confirmOnAnotherDevice: async () => {
          throw new Error("INTERACTIVE_AUTH_REQUIRED");
        },
      });
    } catch (error) {
      const message = extractErrorMessage(error);
      await this.closeClient();
      await this.handleConnectionFailure(message, true);
      throw new Error(
        message.includes("INTERACTIVE_AUTH_REQUIRED")
          ? "Telegram session expired. Please reconnect in Settings -> Integrations."
          : message
      );
    }

    this.ready = true;
    await this.setState("ready", null, {
      sessionReady: true,
      passwordHint: "",
      retryCount: 0,
      lastConnectedAt: new Date(),
    });

    return client;
  }

  private async createClient(apiId: string, apiHash: string): Promise<Client> {
    if (!apiId || !apiHash) {
      throw new Error("Telegram API ID and API Hash must be configured.");
    }

    const settings = await getSettings();
    if (!settings.telegram_phone) {
      throw new Error("Telegram phone number must be configured.");
    }

    mkdirSync(getDbDir(), { recursive: true });
    mkdirSync(getFilesDir(), { recursive: true });

    return createClient({
      apiId: Number(apiId),
      apiHash,
      databaseDirectory: getDbDir(),
      filesDirectory: getFilesDir(),
    });
  }

  private attachClientErrorHandler(client: Client): void {
    client.on("error", (error) => {
      void this.handleClientError(client, error);
    });
  }

  private async handleClientError(client: Client, error: unknown): Promise<void> {
    if (this.client !== client) {
      return;
    }

    const message = extractErrorMessage(error);
    await logger.error("system", "Telegram client error", { error: message });

    await this.closeClient();
    this.ready = false;
    this.rejectPendingInputs(message);
    await this.handleConnectionFailure(message, false);
  }

  private async handleConnectionFailure(
    message: string,
    preserveRetryBudget: boolean
  ): Promise<void> {
    const expired = message.includes("INTERACTIVE_AUTH_REQUIRED");
    const duplicated = message.includes("AUTH_KEY_DUPLICATED");
    const error =
      duplicated
        ? "Telegram session conflicted with another instance. Stop the other instance and reconnect."
        : expired
          ? "Telegram session expired. Please reconnect in Settings -> Integrations."
          : message;

    const retryCount = preserveRetryBudget ? 0 : 1;

    await this.setState(expired ? "disconnected" : "error", error, {
      sessionReady: false,
      retryCount: { increment: retryCount },
      passwordHint: "",
    });

    if (!expired && !this.shuttingDown) {
      await sleep(CONNECT_RETRY_DELAY_MS);
    }
  }

  private async closeClient(): Promise<void> {
    const client = this.client;
    this.client = null;
    if (!client) {
      return;
    }

    try {
      await client.close();
    } catch {
      // Ignore close failures during cleanup.
    }
  }

  private rejectPendingInputs(message: string): void {
    this.pendingCodeRequest?.reject(new Error(message));
    this.pendingPasswordRequest?.reject(new Error(message));
    this.pendingCodeRequest = null;
    this.pendingPasswordRequest = null;
    this.passwordHint = "";
  }

  private async waitForStateTransition(previousState: TelegramAuthState): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < CONNECT_TRANSITION_TIMEOUT_MS) {
      if (this.currentState !== previousState) {
        return;
      }
      await sleep(100);
    }
  }

  private async resolveChatId(channelId: string): Promise<number | null> {
    const cached = this.chatIdMap.get(channelId);
    if (cached) {
      return cached;
    }

    const client = await this.ensureOperationalClient();
    try {
      const chat = (await client.invoke({
        _: "searchPublicChat",
        username: channelId.replace("@", ""),
      })) as { _: string; id?: number } | null;

      if (chat && chat._ === "chat" && chat.id) {
        this.chatIdMap.set(channelId, chat.id);
        return chat.id;
      }
    } catch (error) {
      await logger.warn("system", `Could not resolve channel ${channelId}`, {
        error: extractErrorMessage(error),
      });
    }

    return null;
  }

  private async setState(
    state: TelegramAuthState,
    error: string | null,
    extraData?: Record<string, unknown>
  ): Promise<void> {
    this.currentState = state;

    const data: Record<string, unknown> = {
      state,
      error,
      passwordHint: this.passwordHint,
      lastHeartbeatAt: new Date(),
      owner: this.owner,
      ...extraData,
    };

    await updateTelegramRuntimeState(data);
  }
}
