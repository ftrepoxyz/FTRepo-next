import { withTelegramClient } from "../src/lib/telegram/client";
import { scanChannel } from "../src/lib/telegram/scanner";
import { processNextIpa } from "../src/lib/pipeline/orchestrator";
import { generateAllJson } from "../src/lib/json/generator";
import { cleanupReleases } from "../src/lib/github/cleanup";
import { cleanupOldLogs } from "../src/lib/cleanup/logs";
import { cleanupCaches } from "../src/lib/cleanup/cache";
import { scheduleTask, stopAllTasks } from "../src/lib/pipeline/scheduler";
import { getTelegramChannels, getSettings } from "../src/lib/config";
import { logger } from "../src/lib/logger";

let running = true;

async function main() {
  await logger.info("system", "FTRepo worker starting...");

  const settings = await getSettings();
  const channels = await getTelegramChannels();

  if (channels.length === 0) {
    await logger.warn("system", "No Telegram channels configured. Worker will idle.");
  }

  const chatIdMap = new Map<string, number>();

  const primeChatIds = async (channelList: string[]) => {
    await withTelegramClient(async (client) => {
      for (const channel of channelList) {
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
    });
  };

  try {
    await primeChatIds(channels);
  } catch (e) {
    await logger.error(
      "system",
      "Telegram session not ready — complete auth in Settings -> Integrations",
      {
        error: String(e),
      }
    );
  }

  // Schedule recurring tasks
  scheduleTask(
    "scan",
    async () => {
      // Refresh channel list each scan cycle to pick up newly added channels
      const currentChannels = await getTelegramChannels();
      try {
        await withTelegramClient(async (client) => {
          for (const channel of currentChannels) {
            await scanChannel(client, channel, settings.scan_message_limit);
            if (!chatIdMap.has(channel)) {
              try {
                const chat = (await client.invoke({
                  _: "searchPublicChat",
                  username: channel.replace("@", ""),
                })) as { id: number };
                chatIdMap.set(channel, chat.id);
              } catch {
                // Will be resolved on-the-fly during processing.
              }
            }
          }
        });
      } catch (e) {
        await logger.warn("system", "Scheduled scan skipped because Telegram is unavailable", {
          error: String(e),
        });
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
  try {
    await withTelegramClient(async (client) => {
      for (const channel of channels) {
        await scanChannel(client, channel, settings.scan_message_limit);
      }
    });
  } catch (e) {
    await logger.warn("system", "Initial channel scan skipped because Telegram is unavailable", {
      error: String(e),
    });
  }

  // Main processing loop
  await logger.success("system", "Worker started. Processing queue...");
  while (running) {
    try {
      const currentSettings = await getSettings();
      if (!currentSettings.system_enabled) {
        // System is offline — wait and check again
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      const processed = await processNextIpa(chatIdMap);
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
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

main().catch(async (e) => {
  console.error("Worker fatal error:", e);
  await logger.error("system", "Worker crashed", { error: String(e) });
  process.exit(1);
});
