import { prisma } from "../db";
import { deleteReleaseAsset, getRelease, deleteRelease } from "./releases";
import { logger } from "../logger";
import { getSettings } from "../config";
import { matchTweak } from "@/lib/ipa/tweak-matcher";
import { shouldKeepIpaForLockedChannel } from "@/lib/json/grouping";

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
  const knownTweaks = settings.known_tweaks;
  let deletedReleases = 0;
  let freedBytes = 0;

  try {
    // Get all IPAs grouped by composite key (bundleId::tweak)
    const allIpas = await prisma.downloadedIpa.findMany({
      orderBy: [{ bundleId: "asc" }, { createdAt: "desc" }],
    });

    const grouped = new Map<string, typeof allIpas>();
    for (const ipa of allIpas) {
      if (!shouldKeepIpaForLockedChannel(ipa, knownTweaks)) {
        continue;
      }

      const tweaks = (ipa.tweaks as string[]) || [];
      const { groupKey } = matchTweak(ipa.bundleId, ipa.appName, tweaks, ipa.isTweaked, knownTweaks, ipa.channelId);
      const list = grouped.get(groupKey) || [];
      list.push(ipa);
      grouped.set(groupKey, list);
    }

    // Track release IDs that had assets removed, so we can check if they're empty
    const affectedReleaseIds = new Set<number>();

    // Version-based cleanup: remove excess versions per app (grouped by composite key)
    for (const [groupKey, ipas] of grouped) {
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
            await logger.warn("cleanup", `Failed to delete asset for ${groupKey}@${ipa.version}`, {
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
            await logger.warn("cleanup", `Failed to delete release for ${groupKey}@${ipa.version}`, {
              error: String(e),
            });
          }
        }

        await prisma.downloadedIpa.delete({ where: { id: ipa.id } });
      }

      await logger.info("cleanup", `Cleaned up ${toRemove.length} old versions of ${groupKey}`);
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

/**
 * Enforce the max_versions_per_app limit for a single composite key group.
 * Called inline after a new IPA is saved to the database so old versions
 * are cleaned up immediately instead of waiting for the periodic cleanup.
 */
export async function enforceVersionLimit(
  bundleId: string,
  appName: string,
  tweaks: string[],
  isTweaked: boolean,
  channelId: string
): Promise<void> {
  const settings = await getSettings();
  const maxVersions = settings.max_versions_per_app;
  const knownTweaks = settings.known_tweaks;

  const { groupKey } = matchTweak(bundleId, appName, tweaks, isTweaked, knownTweaks, channelId);

  // Get all IPAs and filter to same composite key (sorted newest first)
  const allIpas = await prisma.downloadedIpa.findMany({
    where: { bundleId },
    orderBy: { createdAt: "desc" },
  });

  const groupIpas = allIpas.filter((ipa) => {
    if (!shouldKeepIpaForLockedChannel(ipa, knownTweaks)) {
      return false;
    }

    const t = (ipa.tweaks as string[]) || [];
    const result = matchTweak(ipa.bundleId, ipa.appName, t, ipa.isTweaked, knownTweaks, ipa.channelId);
    return result.groupKey === groupKey;
  });

  if (groupIpas.length <= maxVersions) return;

  const toRemove = groupIpas.slice(maxVersions);
  const affectedReleaseIds = new Set<number>();

  for (const ipa of toRemove) {
    if (ipa.githubAssetId) {
      try {
        await deleteReleaseAsset(ipa.githubAssetId);
        if (ipa.githubReleaseId) {
          affectedReleaseIds.add(ipa.githubReleaseId);
        }
      } catch (e) {
        await logger.warn("cleanup", `Failed to delete asset for ${groupKey}@${ipa.version}`, {
          error: String(e),
        });
      }
    }

    await prisma.downloadedIpa.delete({ where: { id: ipa.id } });
  }

  // Clean up any releases that became empty
  for (const releaseId of affectedReleaseIds) {
    try {
      const release = await getRelease(releaseId);
      if (!release) continue;
      const hasIpaAssets = release.assets.some((a) => a.name.toLowerCase().endsWith(".ipa"));
      if (!hasIpaAssets) {
        await deleteRelease(releaseId);
      }
    } catch {
      // Ignore — periodic cleanup will catch it
    }
  }

  if (toRemove.length > 0) {
    await logger.info("cleanup", `Pruned ${toRemove.length} old version(s) of ${groupKey} (limit: ${maxVersions})`);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
