import { clearExpiredCache } from "../appstore/cache";
import { logger } from "../logger";

/**
 * Run all cache cleanup tasks.
 */
export async function cleanupCaches(): Promise<{ expiredAppStore: number }> {
  const expiredAppStore = await clearExpiredCache();

  if (expiredAppStore > 0) {
    await logger.info("cleanup", `Cleared ${expiredAppStore} expired App Store cache entries`);
  }

  return { expiredAppStore };
}
