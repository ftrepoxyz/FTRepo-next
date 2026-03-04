import { DownloadedIpa } from "@prisma/client";
import { TweakConfig } from "@/types/config";
import { getLatestPerCompositeKey } from "./grouping";

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
  channelPriorities?: Map<string, number>
): string {
  const latestByKey = getLatestPerCompositeKey(ipas, knownTweaks, channelPriorities);
  const apps: ESignApp[] = [];

  for (const ipa of latestByKey) {
    apps.push({
      name: ipa.appName,
      version: ipa.version,
      versionDate: ipa.createdAt.toISOString().split("T")[0],
      size: Number(ipa.fileSize),
      down: ipa.downloadUrl || ipa.githubAssetUrl || "",
      developerName: ipa.developerName || "Unknown Developer",
      bundleIdentifier: ipa.bundleId,
      iconURL: ipa.iconUrl || "",
      localizedDescription: ipa.description || ipa.appName,
      screenshotURLs: (ipa.screenshotUrls as string[]) || [],
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
