import { prisma } from "../db";
import { deleteReleaseAsset, getRelease, deleteRelease } from "./releases";
import { logger } from "../logger";
import { getSettings } from "../config";

interface CleanupResult {
  deletedReleases: number;
  freedBytes: number;
}

/**
 * Clean up old GitHub releases based on configured limits.
 * Deletes individual assets from daily grouped releases, then removes
 * any releases that have no remaining IPA assets.
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

    // Track release IDs that had assets removed, so we can check if they're empty
    const affectedReleaseIds = new Set<number>();

    // Version-based cleanup: remove excess versions per app
    for (const [bundleId, ipas] of grouped) {
      if (ipas.length <= maxVersions) continue;

      const toRemove = ipas.slice(maxVersions);
      for (const ipa of toRemove) {
        // Delete the individual asset if we have an asset ID
        if (ipa.githubAssetId) {
          try {
            await deleteReleaseAsset(ipa.githubAssetId);
            freedBytes += Number(ipa.fileSize);
            deletedReleases++;
            if (ipa.githubReleaseId) {
              affectedReleaseIds.add(ipa.githubReleaseId);
            }
          } catch (e) {
            await logger.warn("cleanup", `Failed to delete asset for ${bundleId}@${ipa.version}`, {
              error: String(e),
            });
          }
        } else if (ipa.githubReleaseId) {
          // Legacy: no asset ID stored, delete the entire release
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

    // Clean up empty releases (daily releases with no remaining IPA assets)
    for (const releaseId of affectedReleaseIds) {
      try {
        const release = await getRelease(releaseId);
        if (!release) continue;

        const hasIpaAssets = release.assets.some((a) => a.name.toLowerCase().endsWith(".ipa"));
        if (!hasIpaAssets) {
          await deleteRelease(releaseId);
          await logger.info("cleanup", `Deleted empty release ${releaseId}`);
        }
      } catch (e) {
        await logger.warn("cleanup", `Failed to check/delete empty release ${releaseId}`, {
          error: String(e),
        });
      }
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
