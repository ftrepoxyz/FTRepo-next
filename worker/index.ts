import { generateAllJson } from "../src/lib/json/generator";
import { cleanupReleases } from "../src/lib/github/cleanup";
import { cleanupOldLogs } from "../src/lib/cleanup/logs";
import { cleanupCaches } from "../src/lib/cleanup/cache";
import { getSettings } from "../src/lib/config";
import { logger } from "../src/lib/logger";
import { TelegramService } from "../src/lib/telegram/service";

let running = true;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const telegram = new TelegramService();
  let nextScanAt = 0;
  let nextJsonAt = 0;
  let nextCleanupAt = 0;

  await logger.info("system", "FTRepo worker starting...");
  await telegram.start();

  while (running) {
    try {
      await telegram.heartbeat();

      const settings = await getSettings();
      const now = Date.now();
      let didWork = false;

      if (await telegram.processNextCommand()) {
        didWork = true;
      }

      if (settings.system_enabled) {
        if (now >= nextScanAt) {
          try {
            await telegram.scanConfiguredChannels(settings.scan_message_limit);
          } catch (error) {
            await logger.warn("system", "Scheduled scan skipped because Telegram is unavailable", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          nextScanAt = Date.now() + settings.scan_interval_minutes * 60 * 1000;
          didWork = true;
        }

        if (now >= nextJsonAt) {
          await generateAllJson(true);
          nextJsonAt = Date.now() + settings.json_regen_interval_minutes * 60 * 1000;
          didWork = true;
        }

        if (now >= nextCleanupAt) {
          await cleanupReleases();
          await cleanupOldLogs();
          await cleanupCaches();
          nextCleanupAt = Date.now() + settings.cleanup_interval_hours * 60 * 60 * 1000;
          didWork = true;
        }

        if (await telegram.processNextQueuedIpa()) {
          didWork = true;
        }
      }

      if (!didWork) {
        await sleep(1000);
      }
    } catch (error) {
      await logger.error("system", "Worker loop error", {
        error: error instanceof Error ? error.message : String(error),
      });
      await sleep(5000);
    }
  }

  await telegram.stop();
}

async function shutdown(signal: string) {
  await logger.info("system", `Received ${signal}, shutting down gracefully...`);
  running = false;
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

main().catch(async (error) => {
  console.error("Worker fatal error:", error);
  await logger.error("system", "Worker crashed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
