import { createClient, configure, type Client } from "tdl";
import { getConfig } from "../config";
import { logger } from "../logger";

export type { Client };

let client: Client | null = null;

/**
 * Initialize and return the TDLib client.
 * The client maintains a persistent connection to Telegram.
 */
export async function getTelegramClient(): Promise<Client> {
  if (client) return client;

  const config = getConfig();
  const apiId = config.env.TELEGRAM_API_ID;
  const apiHash = config.env.TELEGRAM_API_HASH;

  if (!apiId || !apiHash) {
    throw new Error("TELEGRAM_API_ID and TELEGRAM_API_HASH must be configured");
  }

  try {
    // Try to load prebuilt-tdlib
    const { getTdjson } = await import("prebuilt-tdlib");
    configure({ tdjson: getTdjson() });
  } catch {
    // Fallback: use system TDLib
  }

  client = createClient({
    apiId: Number(apiId),
    apiHash,
    tdlibParameters: {
      database_directory: "./tdlib-data/db",
      files_directory: "./tdlib-data/files",
    },
  });

  client.on("error", (err) => {
    logger.error("system", "TDLib error", { error: String(err) });
  });

  await client.login();
  await logger.success("system", "TDLib client connected");

  return client;
}

/**
 * Close the TDLib client.
 */
export async function closeTelegramClient(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    await logger.info("system", "TDLib client disconnected");
  }
}
