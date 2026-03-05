import { createClient, configure, type Client } from "tdl";
import { mkdirSync, rmSync } from "fs";
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

/** How long to wait for TDLib login before declaring the session stale. */
const LOGIN_TIMEOUT_MS = 30_000;

interface AuthManager {
  client: Client | null;
  state: TelegramAuthState;
  error: string | null;
  passwordHint: string;
  stateVersion: number;
  codeResolver: ((code: string) => void) | null;
  passwordResolver: ((password: string) => void) | null;
  /** Timestamp when the current connection attempt started. */
  connectingSince: number | null;
  /** Handle for the login timeout so it can be cleared on success. */
  loginTimeout: ReturnType<typeof setTimeout> | null;
}

const globalForTdl = globalThis as unknown as {
  telegramAuth: AuthManager | undefined;
};

function getManager(): AuthManager {
  if (!globalForTdl.telegramAuth) {
    globalForTdl.telegramAuth = {
      client: null,
      state: "disconnected",
      error: null,
      passwordHint: "",
      stateVersion: 0,
      codeResolver: null,
      passwordResolver: null,
      connectingSince: null,
      loginTimeout: null,
    };
  }
  return globalForTdl.telegramAuth;
}

function setState(
  mgr: AuthManager,
  state: TelegramAuthState,
  error?: string | null
) {
  mgr.state = state;
  if (error !== undefined) mgr.error = error;
  mgr.stateVersion++;
}

async function waitForStateUpdate(
  mgr: AuthManager,
  timeoutMs = 5000
): Promise<void> {
  const v = mgr.stateVersion;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (mgr.stateVersion !== v) return;
    await new Promise((r) => setTimeout(r, 100));
  }
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

  if (mgr.state === "ready") return;
  if (mgr.state === "waiting_code" || mgr.state === "waiting_password") {
    return;
  }
  if (mgr.state === "connecting") {
    // Allow a retry if the previous attempt has been stuck for too long
    const elapsed = mgr.connectingSince
      ? Date.now() - mgr.connectingSince
      : Infinity;
    if (elapsed < LOGIN_TIMEOUT_MS) return;
    // Stuck — fall through to clean up and retry
    await logger.warn(
      "system",
      `TDLib stuck in "connecting" for ${Math.round(elapsed / 1000)}s, retrying`
    );
  }

  const settings = await getSettings();
  if (!settings.telegram_api_id || !settings.telegram_api_hash) {
    setState(mgr, "error", "Telegram API ID and API Hash must be configured");
    return;
  }
  if (!settings.telegram_phone) {
    setState(mgr, "error", "Phone number must be configured");
    return;
  }

  // Clean up previous client
  if (mgr.client) {
    try {
      await mgr.client.close();
    } catch {
      // ignore
    }
    mgr.client = null;
  }

  setState(mgr, "connecting", null);
  mgr.connectingSince = Date.now();
  mgr.passwordHint = "";
  if (mgr.loginTimeout) clearTimeout(mgr.loginTimeout);

  try {
    const { getTdjson } = await import("prebuilt-tdlib");
    configure({ tdjson: getTdjson() });
  } catch {
    // Fallback: use system TDLib
  }

  const dbDir = resolve(process.cwd(), "tdlib-data/db");
  const filesDir = resolve(process.cwd(), "tdlib-data/files");
  mkdirSync(dbDir, { recursive: true });
  mkdirSync(filesDir, { recursive: true });

  const client = createClient({
    apiId: Number(settings.telegram_api_id),
    apiHash: settings.telegram_api_hash,
    databaseDirectory: dbDir,
    filesDirectory: filesDir,
  });

  client.on("error", async (err) => {
    const errStr = String(err);
    logger.error("system", "TDLib error", { error: errStr });

    if (errStr.includes("AUTH_KEY_DUPLICATED")) {
      // Session is invalid — close client, wipe session data, prompt re-login
      try {
        await client.close();
      } catch {
        // ignore
      }
      mgr.client = null;
      rmSync(dbDir, { recursive: true, force: true });
      rmSync(filesDir, { recursive: true, force: true });
      setState(
        mgr,
        "error",
        "Session invalidated (used elsewhere). Please reconnect to log in again."
      );
      logger.warn("system", "Cleared stale TDLib session due to AUTH_KEY_DUPLICATED");
    }
  });

  mgr.client = client;
  const phone = settings.telegram_phone;

  // Start login in background — callbacks pause via deferred promises
  client
    .login({
      getPhoneNumber: async (retry) => {
        if (retry) {
          setState(
            mgr,
            "error",
            "Invalid phone number. Update in Settings and reconnect."
          );
          throw new Error("Invalid phone number");
        }
        return phone;
      },
      getAuthCode: (retry) => {
        setState(
          mgr,
          "waiting_code",
          retry ? "Invalid code, please try again." : null
        );
        return new Promise<string>((resolve) => {
          mgr.codeResolver = resolve;
        });
      },
      getPassword: (hint, retry) => {
        mgr.passwordHint = hint;
        setState(
          mgr,
          "waiting_password",
          retry ? "Invalid password, please try again." : null
        );
        return new Promise<string>((resolve) => {
          mgr.passwordResolver = resolve;
        });
      },
      confirmOnAnotherDevice: (link) => {
        setState(mgr, "error", `Confirm on another device: ${link}`);
      },
    })
    .then(() => {
      if (mgr.loginTimeout) { clearTimeout(mgr.loginTimeout); mgr.loginTimeout = null; }
      mgr.connectingSince = null;
      setState(mgr, "ready", null);
      logger.success("system", "Telegram client authenticated");
    })
    .catch(async (err) => {
      if (mgr.loginTimeout) { clearTimeout(mgr.loginTimeout); mgr.loginTimeout = null; }
      mgr.connectingSince = null;
      const errStr = String(err);
      if (errStr.includes("AUTH_KEY_DUPLICATED")) {
        try { await client.close(); } catch { /* ignore */ }
        mgr.client = null;
        rmSync(dbDir, { recursive: true, force: true });
        rmSync(filesDir, { recursive: true, force: true });
        setState(
          mgr,
          "error",
          "Session invalidated (used elsewhere). Please reconnect to log in again."
        );
        logger.warn("system", "Cleared stale TDLib session due to AUTH_KEY_DUPLICATED");
      } else if (mgr.state !== "error") {
        setState(mgr, "error", errStr);
      }
      logger.error("system", "Telegram auth failed", { error: errStr });
    });

  // Safety net: if login neither succeeds nor fails within the timeout,
  // the session is most likely stale. Wipe it and let the user reconnect.
  mgr.loginTimeout = setTimeout(async () => {
    mgr.loginTimeout = null;
    mgr.connectingSince = null;
    if (mgr.state !== "connecting") return; // already resolved

    await logger.warn(
      "system",
      "TDLib login timed out — wiping stale session"
    );
    try { await client.close(); } catch { /* ignore */ }
    mgr.client = null;
    rmSync(dbDir, { recursive: true, force: true });
    rmSync(filesDir, { recursive: true, force: true });
    setState(
      mgr,
      "error",
      "Connection timed out. The saved session may be stale. Please reconnect."
    );
  }, LOGIN_TIMEOUT_MS);

  // Wait for either immediate auth (existing session) or state transition
  await waitForStateUpdate(mgr);
}

export async function submitAuthCode(code: string): Promise<void> {
  const mgr = getManager();
  if (mgr.state !== "waiting_code" || !mgr.codeResolver) {
    throw new Error("Not waiting for verification code");
  }
  const resolver = mgr.codeResolver;
  mgr.codeResolver = null;
  mgr.error = null;
  resolver(code);
  await waitForStateUpdate(mgr);
}

export async function submitAuthPassword(password: string): Promise<void> {
  const mgr = getManager();
  if (mgr.state !== "waiting_password" || !mgr.passwordResolver) {
    throw new Error("Not waiting for password");
  }
  const resolver = mgr.passwordResolver;
  mgr.passwordResolver = null;
  mgr.error = null;
  resolver(password);
  await waitForStateUpdate(mgr);
}

export async function getTelegramClient(): Promise<Client> {
  const mgr = getManager();

  // Auto-reconnect using existing session if state was lost (e.g. server restart)
  if (mgr.state === "disconnected") {
    await startTelegramAuth();
  }

  if (mgr.state !== "ready" || !mgr.client) {
    throw new Error(
      "Telegram is not connected. Go to Settings → Integrations to connect."
    );
  }
  return mgr.client;
}

export async function closeTelegramClient(): Promise<void> {
  const mgr = getManager();
  if (mgr.loginTimeout) { clearTimeout(mgr.loginTimeout); mgr.loginTimeout = null; }
  if (mgr.client) {
    try {
      await mgr.client.close();
    } catch {
      // ignore
    }
    await logger.info("system", "TDLib client disconnected");
  }
  globalForTdl.telegramAuth = undefined;
}

export async function resetTelegramClient(): Promise<void> {
  await closeTelegramClient();

  // Wipe TDLib session data
  const dbDir = resolve(process.cwd(), "tdlib-data/db");
  const filesDir = resolve(process.cwd(), "tdlib-data/files");
  rmSync(dbDir, { recursive: true, force: true });
  rmSync(filesDir, { recursive: true, force: true });

  // Clear credentials from DB
  const { prisma } = await import("../db");
  await prisma.setting.deleteMany({
    where: {
      key: { in: ["telegram_api_id", "telegram_api_hash", "telegram_phone"] },
    },
  });

  const { invalidateSettingsCache } = await import("../config");
  invalidateSettingsCache();

  await logger.info("system", "Telegram integration fully reset");
}
