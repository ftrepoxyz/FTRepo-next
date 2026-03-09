import { DownloadedIpa } from "@prisma/client";
import { TweakConfig } from "@/types/config";
import { enhanceAppleScreenshotUrls } from "../appstore/images";
import {
  AppNameOverrideMaps,
  getLatestPerCompositeKey,
  resolveDisplayName,
} from "./grouping";

interface ESignRepo {
  name: string;
  identifier: string;
  apps: ESignApp[];
}

interface ESignApp {
  name: string;
  version: string;
  versionDate: string;
  size: number;
  down: string;
  developerName: string;
  bundleIdentifier: string;
  iconURL: string;
  localizedDescription: string;
  screenshotURLs: string[];
  tintColor: string;
}

/**
 * Generate ESign-format JSON (esign.json).
 * Flat format with single version per app, uses screenshotURLs key.
 */
export function generateESignJson(
  ipas: DownloadedIpa[],
  source: { name: string; tintColor: string },
  knownTweaks: TweakConfig[],
  channelPriorities?: Map<string, number>,
  overrides?: AppNameOverrideMaps
): string {
  const latestByKey = getLatestPerCompositeKey(ipas, knownTweaks, channelPriorities);
  const apps: ESignApp[] = [];

  for (const { ipa, matchedTweak, groupKey } of latestByKey) {
    const displayName = resolveDisplayName({
      appName: ipa.appName,
      groupKey,
      matchedTweak,
      overrides,
      feed: "global",
    });
    apps.push({
      name: displayName,
      version: ipa.version,
      versionDate: ipa.createdAt.toISOString().split("T")[0],
      size: Number(ipa.fileSize),
      down: ipa.downloadUrl || ipa.githubAssetUrl || "",
      developerName: ipa.developerName || "Unknown Developer",
      bundleIdentifier: ipa.bundleId,
      iconURL: ipa.iconUrl || "",
      localizedDescription: ipa.description || ipa.appName,
      screenshotURLs: enhanceAppleScreenshotUrls(ipa.screenshotUrls),
      tintColor: source.tintColor,
    });
  }

  const repo: ESignRepo = {
    name: source.name,
    identifier: `com.${source.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.source`,
    apps,
  };

  return JSON.stringify(repo, null, 2);
}
