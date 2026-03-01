import { prisma } from "../db";
import { getSettings } from "../config";
import { logger } from "../logger";

/**
 * Delete activity logs older than the configured retention period.
 */
export async function cleanupOldLogs(): Promise<number> {
  const settings = await getSettings();
  const retentionDays = settings.log_retention_days;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const result = await prisma.activityLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  if (result.count > 0) {
    await logger.info("cleanup", `Deleted ${result.count} logs older than ${retentionDays} days`);
  }

  return result.count;
}
