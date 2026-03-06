import { unlinkSync, existsSync } from "fs";
import type { Client as TdlClient } from "tdl";
import { prisma } from "../db";
import { logger } from "../logger";
import { extractIpa } from "../ipa/extractor";
import { cachePrivacyDescriptions } from "../ipa/privacy";
import { getCachedLookup } from "../appstore/cache";
import { uploadIpaToDailyRelease } from "../github/releases";
import { claimNextPending, markCompleted, markFailed } from "./queue";
import { downloadIpaFromMessage } from "../telegram/downloader";
import { getTelegramClient } from "../telegram/client";
import { getTelegramChannels } from "../config";
import { enforceVersionLimit } from "../github/cleanup";

const globalForProcessing = globalThis as unknown as {
  queueProcessing: boolean | undefined;
};

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
  client: TdlClient,
  chatIdMap: Map<string, number>
): Promise<boolean> {
  const entry = await claimNextPending();
  if (!entry) return false;

  let tempPath: string | null = null;

  try {
    await prisma.processedMessage.update({
      where: { id: entry.id },
      data: { status: "processing" },
    });

    // Step 1: Download from Telegram
    let chatId = chatIdMap.get(entry.channelId);
    if (!chatId) {
      // Channel not in map — try to resolve on-the-fly (e.g. channel added after worker started)
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
      await markFailed(entry.id, `Unknown channel: ${entry.channelId}`);
      return true;
    }

    await logger.info("process", `Processing ${entry.fileName} from ${entry.channelId}`);

    tempPath = await downloadIpaFromMessage(client, chatId, entry.messageId);
    if (!tempPath) {
      await markFailed(entry.id, "Download returned no file");
      return true;
    }

    // Step 2: Extract IPA metadata
    const { metadata } = await extractIpa(tempPath);
    await logger.info("process", `Extracted: ${metadata.appName} ${metadata.version} (${metadata.bundleId})`);

    // Step 3: Cache privacy descriptions
    if (Object.keys(metadata.privacyInfo).length > 0) {
      await cachePrivacyDescriptions(metadata.privacyInfo);
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

  return true;
}

/**
 * Start processing the queue in the background.
 * Resolves channel chat IDs, then processes pending items until the queue is empty.
 * Only one instance runs at a time (guarded by global flag).
 */
export async function startProcessing(): Promise<void> {
  if (globalForProcessing.queueProcessing) return;
  globalForProcessing.queueProcessing = true;

  try {
    const client = await getTelegramClient();
    const channels = await getTelegramChannels();

    // Build channel → TDLib chat ID map
    const chatIdMap = new Map<string, number>();
    for (const channelId of channels) {
      try {
        const chat = (await client.invoke({
          _: "searchPublicChat",
          username: channelId.replace("@", ""),
        })) as { _: string; id: number } | null;
        if (chat && chat._ === "chat") {
          chatIdMap.set(channelId, chat.id);
        }
      } catch (e) {
        await logger.warn("process", `Could not resolve channel ${channelId}`, {
          error: String(e),
        });
      }
    }

    await logger.info("process", `Queue processor started, ${chatIdMap.size} channel(s) pre-resolved`);

    // Process until queue is empty
    while (await processNextIpa(client, chatIdMap)) {
      // Brief pause between items to avoid overwhelming resources
      await new Promise((r) => setTimeout(r, 2000));
    }

    await logger.info("process", "Queue processor finished — no more pending items");
  } catch (e) {
    await logger.error("process", "Queue processor failed", {
      error: String(e),
    });
  } finally {
    globalForProcessing.queueProcessing = false;
  }
}
