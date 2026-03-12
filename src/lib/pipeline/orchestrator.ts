import { unlinkSync, existsSync } from "fs";
import type { Client as TdlClient } from "tdl";
import { prisma } from "../db";
import { logger } from "../logger";
import { extractIpa } from "../ipa/extractor";
import { cachePrivacyDescriptions } from "../ipa/privacy";
import { getCachedLookup } from "../appstore/cache";
import { uploadIpaToDailyRelease, deleteReleaseAsset } from "../github/releases";
import {
  claimNextPending,
  claimPendingById,
  markCompleted,
  markFailed,
  markSkipped,
  type QueueEntry,
} from "./queue";
import { downloadIpaFromMessage } from "../telegram/downloader";
import { getSettings } from "../config";
import { enforceVersionLimit } from "../github/cleanup";
import { findLockedChannelTweak, matchTweak } from "../ipa/tweak-matcher";

/**
 * Main processing pipeline:
 * 1. Claim a pending IPA from the queue
 * 2. Download from Telegram
 * 3. Extract metadata (plist, tweaks, entitlements, privacy)
 * 4. Look up App Store metadata
 * 5. Upload to GitHub Releases
 * 6. Save to database
 * 7. Cleanup temp files
 */
export async function processNextIpa(
  chatIdMap: Map<string, number>,
  client: TdlClient
): Promise<boolean> {
  const entry = await claimNextPending();
  if (!entry) return false;

  await processQueueEntry(entry, chatIdMap, client);
  return true;
}

export async function processPendingIpaById(
  id: number,
  chatIdMap: Map<string, number>,
  client: TdlClient
): Promise<boolean> {
  const entry = await claimPendingById(id);
  if (!entry) return false;

  await processQueueEntry(entry, chatIdMap, client);
  return true;
}

async function processQueueEntry(
  entry: QueueEntry,
  chatIdMap: Map<string, number>,
  client: TdlClient
): Promise<void> {
  
  let tempPath: string | null = null;

  try {
    await prisma.processedMessage.update({
      where: { id: entry.id },
      data: { status: "processing" },
    });

    await logger.info("process", `Processing ${entry.fileName} from ${entry.channelId}`);

    let chatId = chatIdMap.get(entry.channelId);
    if (!chatId) {
      try {
        const chat = (await client.invoke({
          _: "searchPublicChat",
          username: entry.channelId.replace("@", ""),
        })) as { _: string; id: number } | null;
        if (chat && chat._ === "chat") {
          chatId = chat.id;
          chatIdMap.set(entry.channelId, chatId);
          await logger.info("process", `Resolved channel ${entry.channelId} on-the-fly`);
        }
      } catch (e) {
        await logger.warn("process", `Could not resolve channel ${entry.channelId}`, {
          error: String(e),
        });
      }
    }

    if (!chatId) {
      await markFailed(entry.id, `Unknown channel or missing file: ${entry.channelId}`);
      return;
    }

    tempPath = await downloadIpaFromMessage(client, chatId, entry.messageId);

    if (!tempPath) {
      await markFailed(entry.id, `Unknown channel or missing file: ${entry.channelId}`);
      return;
    }

    // Step 2: Extract IPA metadata
    const { metadata } = await extractIpa(tempPath);
    await logger.info("process", `Extracted: ${metadata.appName} ${metadata.version} (${metadata.bundleId})`);

    // Step 3: Cache privacy descriptions
    if (Object.keys(metadata.privacyInfo).length > 0) {
      await cachePrivacyDescriptions(metadata.privacyInfo);
    }

    const settings = await getSettings();
    const lockedTweak = findLockedChannelTweak(
      metadata.appName,
      metadata.tweaks,
      settings.known_tweaks
    );

    if (
      lockedTweak?.lockedChannelId &&
      lockedTweak.lockedChannelId !== entry.channelId
    ) {
      const reason = `${metadata.appName} is locked to ${lockedTweak.lockedChannelId}`;
      await markSkipped(entry.id, reason);
      await logger.info(
        "process",
        `Skipped ${metadata.appName} from ${entry.channelId}: ${reason}`
      );
      return;
    }

    // Step 4: App Store lookup
    const appStoreData = await getCachedLookup(metadata.bundleId);

    // Step 5: Upload to GitHub Releases (grouped by date)
    let releaseId: number | undefined;
    let assetId: number | undefined;
    let downloadUrl: string | undefined;
    try {
      const result = await uploadIpaToDailyRelease(
        metadata.appName,
        metadata.version,
        metadata.bundleId,
        metadata.isTweaked,
        metadata.tweaks,
        tempPath
      );
      releaseId = result.releaseId;
      assetId = result.assetId;
      downloadUrl = result.downloadUrl;
    } catch (e) {
      await logger.warn("process", `GitHub upload failed for ${metadata.appName}, saving without download URL`, {
        error: String(e),
      });
    }

    // Step 5b: Remove existing IPAs with same composite key + version
    // (keeps only the most recently posted build for each version)
    try {
      const { groupKey } = matchTweak(
        metadata.bundleId, metadata.appName, metadata.tweaks,
        metadata.isTweaked, settings.known_tweaks, entry.channelId
      );
      const existingIpas = await prisma.downloadedIpa.findMany({
        where: { bundleId: metadata.bundleId, version: metadata.version },
      });
      for (const existing of existingIpas) {
        const t = (existing.tweaks as string[]) || [];
        const result = matchTweak(existing.bundleId, existing.appName, t, existing.isTweaked, settings.known_tweaks, existing.channelId);
        if (result.groupKey === groupKey) {
          if (existing.githubAssetId) {
            try { await deleteReleaseAsset(existing.githubAssetId); } catch { /* already deleted */ }
          }
          await prisma.downloadedIpa.delete({ where: { id: existing.id } });
          await logger.info("process", `Replaced duplicate ${metadata.appName} v${metadata.version}`);
        }
      }
    } catch (e) {
      await logger.warn("process", `Duplicate check failed for ${metadata.appName}`, { error: String(e) });
    }

    // Step 6: Save to database
    await prisma.downloadedIpa.create({
      data: {
        bundleId: metadata.bundleId,
        appName: metadata.appName,
        version: metadata.version,
        buildNumber: metadata.buildNumber,
        minOsVersion: metadata.minOsVersion,
        fileName: entry.fileName,
        fileSize: entry.fileSize,
        iconUrl: appStoreData?.iconUrl || null,
        screenshotUrls: appStoreData?.screenshots || [],
        description: (() => {
          const channel = entry.channelId.startsWith("@") ? entry.channelId : `@${entry.channelId}`;
          const desc = entry.messageText || null;
          if (!desc) return `from ${channel}`;
          return `from ${channel} |\n----------------\n${desc}`;
        })(),
        developerName: appStoreData?.developer || null,
        tweaks: metadata.tweaks,
        isTweaked: metadata.isTweaked,
        entitlements: metadata.entitlements,
        privacyInfo: metadata.privacyInfo,
        githubReleaseId: releaseId,
        githubAssetId: assetId,
        githubAssetUrl: downloadUrl,
        downloadUrl,
        channelId: entry.channelId,
        messageId: entry.messageId,
      },
    });

    // Step 6b: Enforce version limit — prune old versions beyond max_versions_per_app
    try {
      await enforceVersionLimit(
        metadata.bundleId,
        metadata.appName,
        metadata.tweaks,
        metadata.isTweaked,
        entry.channelId
      );
    } catch (e) {
      await logger.warn("process", `Version limit enforcement failed for ${metadata.appName}`, {
        error: String(e),
      });
    }

    await markCompleted(entry.id);
    await logger.success("process", `Successfully processed ${metadata.appName} v${metadata.version}`);
  } catch (e) {
    await markFailed(entry.id, String(e));
    await logger.error("process", `Pipeline failed for ${entry.fileName}`, {
      error: String(e),
    });
  } finally {
    // Step 7: Cleanup temp file
    if (tempPath && existsSync(tempPath)) {
      try {
        unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
