import { unlinkSync, existsSync } from "fs";
import type { Client as TdlClient } from "tdl";
import { prisma } from "../db";
import { logger } from "../logger";
import { extractIpa } from "../ipa/extractor";
import { cachePrivacyDescriptions } from "../ipa/privacy";
import { getCachedLookup } from "../appstore/cache";
import { createReleaseWithIpa } from "../github/releases";
import { claimNextPending, markCompleted, markFailed } from "./queue";
import { downloadIpaFromMessage } from "../telegram/downloader";

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
    const chatId = chatIdMap.get(entry.channelId);
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

    // Step 5: Upload to GitHub Releases
    let releaseId: number | undefined;
    let downloadUrl: string | undefined;
    try {
      const tagName = `${metadata.bundleId}-${metadata.version}-${Date.now()}`;
      const releaseName = `${metadata.appName} v${metadata.version}`;
      const body = [
        `**${metadata.appName}** v${metadata.version}`,
        metadata.isTweaked ? `Tweaks: ${metadata.tweaks.join(", ")}` : "",
        `Bundle ID: ${metadata.bundleId}`,
      ]
        .filter(Boolean)
        .join("\n");

      const result = await createReleaseWithIpa(tagName, releaseName, body, tempPath);
      releaseId = result.releaseId;
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
        description: appStoreData?.description || null,
        developerName: appStoreData?.developer || null,
        tweaks: metadata.tweaks,
        isTweaked: metadata.isTweaked,
        entitlements: metadata.entitlements,
        privacyInfo: metadata.privacyInfo,
        githubReleaseId: releaseId,
        githubAssetUrl: downloadUrl,
        downloadUrl,
        channelId: entry.channelId,
        messageId: entry.messageId,
      },
    });

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
