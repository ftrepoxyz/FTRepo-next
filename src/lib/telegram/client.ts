import { createClient, configure, type Client } from "tdl";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { resolve } from "path";
import { getSettings } from "../config";
import { logger } from "../logger";

export type { Client };

export type TelegramAuthState =
  | "disconnected"
  | "connecting"
  | "waiting_code"
  | "waiting_password"
  | "ready"
  | "error";

const LOGIN_TIMEOUT_MS = 45_000;
const LOCK_WAIT_TIMEOUT_MS = 60_000;
const LOCK_POLL_INTERVAL_MS = 500;
const LOCK_STALE_MS = 120_000;
const LOCK_HEARTBEAT_MS = 5_000;

type ClientPurpose = "auth" | "operation";

interface PendingInputRequest {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

interface SessionLock {
  token: string;
  release: () => Promise<void>;
  heartbeat: ReturnType<typeof setInterval>;
}

interface AuthManager {
  client: Client | null;
  purpose: ClientPurpose | null;
  state: TelegramAuthState;
  error: string | null;
  passwordHint: string;
  stateVersion: number;
  sessionReady: boolean;
  codeRequest: PendingInputRequest | null;
  passwordRequest: PendingInputRequest | null;
  connectingSince: number | null;
  loginTimeout: ReturnType<typeof setTimeout> | null;
  lock: SessionLock | null;
  startPromise: Promise<void> | null;
}

const globalForTdl = globalThis as unknown as {
  telegramAuth: AuthManager | undefined;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDbDir(): string {
  return resolve(process.cwd(), "tdlib-data/db");
}

function getFilesDir(): string {
  return resolve(process.cwd(), "tdlib-data/files");
}

function getLockDir(): string {
  return resolve(process.cwd(), "tdlib-data/session.lock");
}

function hasPersistedSession(): boolean {
  try {
    const dbDir = getDbDir();
    return existsSync(dbDir) && readdirSync(dbDir).length > 0;
  } catch {
    return false;
  }
}

function getManager(): AuthManager {
  if (!globalForTdl.telegramAuth) {
    const sessionReady = hasPersistedSession();
    globalForTdl.telegramAuth = {
      client: null,
      purpose: null,
      state: sessionReady ? "ready" : "disconnected",
      error: null,
      passwordHint: "",
      stateVersion: 0,
      sessionReady,
      codeRequest: null,
      passwordRequest: null,
      connectingSince: null,
      loginTimeout: null,
      lock: null,
      startPromise: null,
    };
  }
  return globalForTdl.telegramAuth;
}

function setState(
  mgr: AuthManager,
  state: TelegramAuthState,
  error?: string | null
): void {
  mgr.state = state;
  if (error !== undefined) {
    mgr.error = error;
  }
  mgr.stateVersion++;
}

async function waitForStateUpdate(
  mgr: AuthManager,
  timeoutMs = 5_000
): Promise<void> {
  const version = mgr.stateVersion;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (mgr.stateVersion !== version) {
      return;
    }
    await sleep(100);
  }
}

function updateLockHeartbeat(lockDir: string, token: string): void {
  writeFileSync(
    resolve(lockDir, "owner.json"),
    JSON.stringify({
      token,
      pid: process.pid,
      updatedAt: new Date().toISOString(),
    })
  );
}

async function acquireSessionLock(timeoutMs = LOCK_WAIT_TIMEOUT_MS): Promise<SessionLock> {
  const lockDir = getLockDir();
  mkdirSync(resolve(process.cwd(), "tdlib-data"), { recursive: true });

  const token = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      mkdirSync(lockDir);
      updateLockHeartbeat(lockDir, token);
      const heartbeat = setInterval(() => {
        try {
          updateLockHeartbeat(lockDir, token);
        } catch {
          // Ignore heartbeat failures; stale locks are recovered separately.
        }
      }, LOCK_HEARTBEAT_MS);

      return {
        token,
        heartbeat,
        release: async () => {
          clearInterval(heartbeat);
          try {
            const raw = readFileSync(resolve(lockDir, "owner.json"), "utf8");
            const owner = JSON.parse(raw) as { token?: string };
            if (owner.token !== token) {
              return;
            }
          } catch {
            // Ignore owner read failures during release.
          }
          rmSync(lockDir, { recursive: true, force: true });
        },
      };
    } catch {
      try {
        const lockStats = statSync(lockDir);
        if (Date.now() - lockStats.mtimeMs > LOCK_STALE_MS) {
          rmSync(lockDir, { recursive: true, force: true });
          continue;
        }
      } catch {
        // The lock may have been released between stat/read attempts.
      }
      await sleep(LOCK_POLL_INTERVAL_MS);
    }
  }

  throw new Error(
    "Telegram is busy in another FTRepo process. Wait a moment and try again."
  );
}

async function releaseSessionLock(mgr: AuthManager): Promise<void> {
  if (!mgr.lock) {
    return;
  }
  const lock = mgr.lock;
  mgr.lock = null;
  await lock.release();
}

function clearLoginTimeout(mgr: AuthManager): void {
  if (mgr.loginTimeout) {
    clearTimeout(mgr.loginTimeout);
    mgr.loginTimeout = null;
  }
  mgr.connectingSince = null;
}

function rejectPendingInput(request: PendingInputRequest | null, message: string): void {
  if (!request) {
    return;
  }
  request.reject(new Error(message));
}

function clearPendingInputs(mgr: AuthManager, message?: string): void {
  if (message) {
    rejectPendingInput(mgr.codeRequest, message);
    rejectPendingInput(mgr.passwordRequest, message);
  }
  mgr.codeRequest = null;
  mgr.passwordRequest = null;
  mgr.passwordHint = "";
}

async function closeActiveClient(
  mgr: AuthManager,
  options: {
    preserveReadyState: boolean;
    releaseLock: boolean;
    nextState?: TelegramAuthState;
    error?: string | null;
    clearReady?: boolean;
    cancelPendingMessage?: string;
  }
): Promise<void> {
  clearLoginTimeout(mgr);
  clearPendingInputs(mgr, options.cancelPendingMessage);

  const client = mgr.client;
  mgr.client = null;
  mgr.purpose = null;

  if (client) {
    try {
      await client.close();
    } catch {
      // Ignore client close failures during cleanup.
    }
  }

  if (options.releaseLock) {
    await releaseSessionLock(mgr);
  }

  if (options.clearReady) {
    mgr.sessionReady = false;
  }

  if (options.nextState) {
    setState(mgr, options.nextState, options.error);
    return;
  }

  if (options.preserveReadyState && mgr.sessionReady) {
    setState(mgr, "ready", options.error ?? null);
    return;
  }

  setState(mgr, "disconnected", options.error ?? null);
}

async function ensureTdlibConfigured(): Promise<void> {
  try {
    const { getTdjson } = await import("prebuilt-tdlib");
    configure({ tdjson: getTdjson() });
  } catch {
    // Fall back to system TDLib.
  }
}

async function buildClient(
  mgr: AuthManager,
  purpose: ClientPurpose
): Promise<{ client: Client; phone: string }> {
  const settings = await getSettings();
  if (!settings.telegram_api_id || !settings.telegram_api_hash) {
    throw new Error("Telegram API ID and API Hash must be configured");
  }
  if (!settings.telegram_phone) {
    throw new Error("Phone number must be configured");
  }

  await ensureTdlibConfigured();

  const dbDir = getDbDir();
  const filesDir = getFilesDir();
  mkdirSync(dbDir, { recursive: true });
  mkdirSync(filesDir, { recursive: true });

  if (!mgr.lock) {
    mgr.lock = await acquireSessionLock();
  }

  const client = createClient({
    apiId: Number(settings.telegram_api_id),
    apiHash: settings.telegram_api_hash,
    databaseDirectory: dbDir,
    filesDirectory: filesDir,
  });

  mgr.client = client;
  mgr.purpose = purpose;

  client.on("error", (err) => {
    void handleClientError(mgr, client, err);
  });

  return { client, phone: settings.telegram_phone };
}

async function handleClientError(
  mgr: AuthManager,
  client: Client,
  err: unknown
): Promise<void> {
  if (mgr.client !== client) {
    return;
  }

  const errStr = String(err);
  await logger.error("system", "TDLib error", { error: errStr });

  if (errStr.includes("AUTH_KEY_DUPLICATED")) {
    mgr.sessionReady = false;
    await closeActiveClient(mgr, {
      preserveReadyState: false,
      releaseLock: true,
      nextState: "error",
      error:
        "Telegram session conflicted with another instance. Wait for the other process to stop, then reconnect.",
      clearReady: true,
      cancelPendingMessage: "Telegram session conflicted with another instance.",
    });
    return;
  }

  if (mgr.purpose === "auth" && mgr.state !== "waiting_code" && mgr.state !== "waiting_password") {
    setState(mgr, "error", errStr);
  }
}

async function authenticateExistingSession(client: Client, phone: string): Promise<void> {
  await client.login({
    getPhoneNumber: async () => phone,
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
}

function startInteractiveLogin(mgr: AuthManager, client: Client, phone: string): void {
  clearLoginTimeout(mgr);
  mgr.connectingSince = Date.now();
  mgr.passwordHint = "";
  setState(mgr, "connecting", null);

  mgr.loginTimeout = setTimeout(() => {
    void (async () => {
      if (mgr.client !== client || mgr.state !== "connecting") {
        return;
      }
      await logger.warn(
        "system",
        "TDLib login timed out while waiting for Telegram to respond"
      );
      mgr.sessionReady = false;
      await closeActiveClient(mgr, {
        preserveReadyState: false,
        releaseLock: true,
        nextState: "error",
        error: "Telegram login timed out. Please try again.",
        clearReady: true,
        cancelPendingMessage: "Telegram login timed out.",
      });
    })();
  }, LOGIN_TIMEOUT_MS);

  client
    .login({
      getPhoneNumber: async (retry) => {
        if (retry) {
          throw new Error("Invalid phone number");
        }
        return phone;
      },
      getAuthCode: async (retry) => {
        setState(
          mgr,
          "waiting_code",
          retry ? "Invalid code, please try again." : null
        );
        return new Promise<string>((resolve, reject) => {
          mgr.codeRequest = { resolve, reject };
        });
      },
      getPassword: async (hint, retry) => {
        mgr.passwordHint = hint;
        setState(
          mgr,
          "waiting_password",
          retry ? "Invalid password, please try again." : null
        );
        return new Promise<string>((resolve, reject) => {
          mgr.passwordRequest = { resolve, reject };
        });
      },
      confirmOnAnotherDevice: async (link) => {
        throw new Error(`Confirm on another device: ${link}`);
      },
    })
    .then(async () => {
      if (mgr.client !== client) {
        return;
      }
      clearLoginTimeout(mgr);
      mgr.sessionReady = true;
      await closeActiveClient(mgr, {
        preserveReadyState: true,
        releaseLock: true,
      });
      await logger.success("system", "Telegram session authenticated");
    })
    .catch(async (err) => {
      if (mgr.client !== client) {
        return;
      }

      clearLoginTimeout(mgr);
      const errStr = String(err);

      if (
        errStr.includes("Telegram connection was closed") ||
        errStr.includes("Telegram session was reset")
      ) {
        return;
      }

      if (errStr.includes("AUTH_KEY_DUPLICATED")) {
        mgr.sessionReady = false;
        await closeActiveClient(mgr, {
          preserveReadyState: false,
          releaseLock: true,
          nextState: "error",
          error:
            "Telegram session conflicted with another instance. Wait for the other process to stop, then reconnect.",
          clearReady: true,
          cancelPendingMessage: "Telegram session conflicted with another instance.",
        });
      } else {
        mgr.sessionReady = false;
        await closeActiveClient(mgr, {
          preserveReadyState: false,
          releaseLock: true,
          nextState: "error",
          error: errStr,
          clearReady: true,
          cancelPendingMessage: errStr,
        });
      }

      await logger.error("system", "Telegram auth failed", { error: errStr });
    });
}

export function getTelegramAuthStatus(): {
  state: TelegramAuthState;
  error: string | null;
  passwordHint: string;
} {
  const mgr = getManager();
  return {
    state: mgr.state,
    error: mgr.error,
    passwordHint: mgr.passwordHint,
  };
}

export async function startTelegramAuth(): Promise<void> {
  const mgr = getManager();

  if (mgr.state === "waiting_code" || mgr.state === "waiting_password") {
    return;
  }

  if (mgr.startPromise) {
    await mgr.startPromise;
    return;
  }

  mgr.startPromise = (async () => {
    if (mgr.client) {
      await closeActiveClient(mgr, {
        preserveReadyState: false,
        releaseLock: true,
        nextState: "disconnected",
        error: null,
        cancelPendingMessage: "Telegram connection was restarted.",
      });
    }

    try {
      const { client, phone } = await buildClient(mgr, "auth");
      startInteractiveLogin(mgr, client, phone);
      await waitForStateUpdate(mgr);
    } catch (err) {
      await releaseSessionLock(mgr);
      setState(mgr, "error", String(err));
    }
  })();

  try {
    await mgr.startPromise;
  } finally {
    mgr.startPromise = null;
  }
}

export async function submitAuthCode(code: string): Promise<void> {
  const mgr = getManager();
  if (mgr.state !== "waiting_code" || !mgr.codeRequest) {
    throw new Error("Not waiting for verification code");
  }

  const request = mgr.codeRequest;
  mgr.codeRequest = null;
  mgr.error = null;
  request.resolve(code);
  await waitForStateUpdate(mgr);
}

export async function submitAuthPassword(password: string): Promise<void> {
  const mgr = getManager();
  if (mgr.state !== "waiting_password" || !mgr.passwordRequest) {
    throw new Error("Not waiting for 2FA password");
  }

  const request = mgr.passwordRequest;
  mgr.passwordRequest = null;
  mgr.error = null;
  request.resolve(password);
  await waitForStateUpdate(mgr);
}

export async function withTelegramClient<T>(
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const mgr = getManager();

  if (mgr.state === "waiting_code" || mgr.state === "waiting_password") {
    throw new Error(
      "Telegram authentication is waiting for input in Settings -> Integrations."
    );
  }

  if (!mgr.sessionReady) {
    throw new Error(
      "Telegram is not connected. Go to Settings -> Integrations and connect it first."
    );
  }

  const { client, phone } = await buildClient(mgr, "operation");

  try {
    await authenticateExistingSession(client, phone);
  } catch (err) {
    const errStr = String(err);
    mgr.sessionReady = false;
    await closeActiveClient(mgr, {
      preserveReadyState: false,
      releaseLock: true,
      nextState: "error",
      error:
        errStr.includes("INTERACTIVE_AUTH_REQUIRED")
          ? "Telegram session expired. Please reconnect in Settings -> Integrations."
          : errStr,
      clearReady: true,
      cancelPendingMessage: "Telegram session expired. Please reconnect.",
    });
    throw new Error(
      errStr.includes("INTERACTIVE_AUTH_REQUIRED")
        ? "Telegram session expired. Please reconnect in Settings -> Integrations."
        : errStr
    );
  }

  setState(mgr, "ready", null);

  try {
    return await fn(client);
  } finally {
    await closeActiveClient(mgr, {
      preserveReadyState: true,
      releaseLock: true,
    });
  }
}

export async function closeTelegramClient(): Promise<void> {
  const mgr = getManager();
  mgr.sessionReady = false;
  await closeActiveClient(mgr, {
    preserveReadyState: false,
    releaseLock: true,
    nextState: "disconnected",
    error: null,
    clearReady: true,
    cancelPendingMessage: "Telegram connection was closed.",
  });
  await logger.info("system", "Telegram connection closed");
}

export async function resetTelegramClient(): Promise<void> {
  const mgr = getManager();
  mgr.sessionReady = false;

  await closeActiveClient(mgr, {
    preserveReadyState: false,
    releaseLock: true,
    nextState: "disconnected",
    error: null,
    clearReady: true,
    cancelPendingMessage: "Telegram session was reset.",
  });

  rmSync(getDbDir(), { recursive: true, force: true });
  rmSync(getFilesDir(), { recursive: true, force: true });
  rmSync(getLockDir(), { recursive: true, force: true });

  await logger.info("system", "Telegram session reset (credentials preserved)");
}
