import { DownloadedIpa } from "@prisma/client";
import { FileConfig } from "@/types/config";
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
  config: FileConfig,
  knownTweaks: string[]
): string {
  const latestByKey = getLatestPerCompositeKey(ipas, knownTweaks);
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
      tintColor: config.source.tintColor,
    });
  }

  const repo: ESignRepo = {
    name: config.source.name,
    identifier: `com.ftrepo.${config.source.name.toLowerCase().replace(/\s+/g, "")}`,
    apps,
  };

  return JSON.stringify(repo, null, 2);
}
