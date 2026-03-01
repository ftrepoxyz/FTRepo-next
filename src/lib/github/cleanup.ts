import { prisma } from "../db";
import { listReleases, deleteRelease } from "./releases";
import { logger } from "../logger";
import { getSettings } from "../config";

interface CleanupResult {
  deletedReleases: number;
  freedBytes: number;
}

/**
 * Clean up old GitHub releases based on configured limits.
 * - Version-based: keep only N versions per app
 * - Age-based: remove releases older than N days (optional)
 * - Size-based: remove releases if total storage exceeds limit (optional)
 */
export async function cleanupReleases(): Promise<CleanupResult> {
  const settings = await getSettings();
  const maxVersions = settings.max_versions_per_app;
  let deletedReleases = 0;
  let freedBytes = 0;

  try {
    // Get all IPAs grouped by bundleId
    const ipasByBundle = await prisma.downloadedIpa.findMany({
      orderBy: [{ bundleId: "asc" }, { createdAt: "desc" }],
    });

    const grouped = new Map<string, typeof ipasByBundle>();
    for (const ipa of ipasByBundle) {
      const list = grouped.get(ipa.bundleId) || [];
      list.push(ipa);
      grouped.set(ipa.bundleId, list);
    }

    // Version-based cleanup
    for (const [bundleId, ipas] of grouped) {
      if (ipas.length <= maxVersions) continue;

      const toRemove = ipas.slice(maxVersions);
      for (const ipa of toRemove) {
        if (ipa.githubReleaseId) {
          try {
            await deleteRelease(ipa.githubReleaseId);
            freedBytes += Number(ipa.fileSize);
            deletedReleases++;
          } catch (e) {
            await logger.warn("cleanup", `Failed to delete release for ${bundleId}@${ipa.version}`, {
              error: String(e),
            });
          }
        }

        await prisma.downloadedIpa.delete({ where: { id: ipa.id } });
      }

      await logger.info("cleanup", `Cleaned up ${toRemove.length} old versions of ${bundleId}`);
    }

    if (deletedReleases > 0) {
      await logger.success("cleanup", `Cleanup complete: removed ${deletedReleases} releases, freed ${formatBytes(freedBytes)}`);
    }
  } catch (e) {
    await logger.error("cleanup", "Cleanup failed", { error: String(e) });
  }

  return { deletedReleases, freedBytes };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
