import { DownloadedIpa } from "@prisma/client";
import { FileConfig } from "@/types/config";

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
  config: FileConfig
): string {
  // Keep only the latest version per bundle ID
  const latestByBundle = getLatestPerBundle(ipas);
  const apps: ESignApp[] = [];

  for (const ipa of latestByBundle) {
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

function getLatestPerBundle(ipas: DownloadedIpa[]): DownloadedIpa[] {
  const map = new Map<string, DownloadedIpa>();

  for (const ipa of ipas) {
    const existing = map.get(ipa.bundleId);
    if (!existing || ipa.createdAt > existing.createdAt) {
      map.set(ipa.bundleId, ipa);
    }
  }

  return Array.from(map.values());
}
