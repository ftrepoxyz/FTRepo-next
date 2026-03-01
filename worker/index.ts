import { getTelegramClient, closeTelegramClient } from "../src/lib/telegram/client";
import { scanChannel } from "../src/lib/telegram/scanner";
import { processNextIpa } from "../src/lib/pipeline/orchestrator";
import { generateAllJson } from "../src/lib/json/generator";
import { cleanupReleases } from "../src/lib/github/cleanup";
import { cleanupOldLogs } from "../src/lib/cleanup/logs";
import { cleanupCaches } from "../src/lib/cleanup/cache";
import { scheduleTask, stopAllTasks } from "../src/lib/pipeline/scheduler";
import { getTelegramChannels, getSettings } from "../src/lib/config";
import { logger } from "../src/lib/logger";
import type { Client as TdlClient } from "tdl";

let running = true;

async function main() {
  await logger.info("system", "FTRepo worker starting...");

  const settings = await getSettings();
  const channels = await getTelegramChannels();

  if (channels.length === 0) {
    await logger.warn("system", "No Telegram channels configured. Worker will idle.");
  }

  // Initialize Telegram client
  let client: TdlClient;
  try {
    client = await getTelegramClient();
  } catch (e) {
    await logger.error("system", "Failed to initialize Telegram client", {
      error: String(e),
    });
    process.exit(1);
  }

  // Resolve channel IDs
  const chatIdMap = new Map<string, number>();
  for (const channel of channels) {
    try {
      const chat = (await client.invoke({
        _: "searchPublicChat",
        username: channel.replace("@", ""),
      })) as { id: number };
      chatIdMap.set(channel, chat.id);
    } catch (e) {
      await logger.warn("system", `Could not resolve channel: ${channel}`, {
        error: String(e),
      });
    }
  }

  // Schedule recurring tasks
  scheduleTask(
    "scan",
    async () => {
      for (const channel of channels) {
        await scanChannel(client, channel);
      }
    },
    settings.scan_interval_minutes
  );

  scheduleTask(
    "json-regen",
    async () => {
      await generateAllJson(true);
    },
    settings.json_regen_interval_minutes
  );

  scheduleTask(
    "cleanup",
    async () => {
      await cleanupReleases();
      await cleanupOldLogs();
      await cleanupCaches();
    },
    settings.cleanup_interval_hours * 60
  );

  // Run initial scan
  await logger.info("system", "Running initial channel scan...");
  for (const channel of channels) {
    await scanChannel(client, channel);
  }

  // Main processing loop
  await logger.success("system", "Worker started. Processing queue...");
  while (running) {
    try {
      const processed = await processNextIpa(client, chatIdMap);
      if (!processed) {
        // No items in queue - wait before checking again
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    } catch (e) {
      await logger.error("system", "Processing loop error", {
        error: String(e),
      });
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  await logger.info("system", `Received ${signal}, shutting down gracefully...`);
  running = false;
  stopAllTasks();
  await closeTelegramClient();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

main().catch(async (e) => {
  console.error("Worker fatal error:", e);
  await logger.error("system", "Worker crashed", { error: String(e) });
  process.exit(1);
});
