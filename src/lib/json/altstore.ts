import { DownloadedIpa } from "@prisma/client";
import { AltStoreApp, AltStoreVersion, FileConfig, NewsEntry } from "@/types/config";

interface AltStoreRepo {
  name: string;
  subtitle: string;
  description: string;
  iconURL: string;
  headerURL: string;
  website: string;
  tintColor: string;
  featuredApps: string[];
  apps: AltStoreApp[];
  news: NewsEntry[];
}

/**
 * Generate AltStore-format JSON (store.json).
 * Apps are grouped by bundle ID, with multiple versions per app.
 */
export function generateAltStoreJson(
  ipas: DownloadedIpa[],
  config: FileConfig,
  maxVersions: number
): string {
  const grouped = groupByBundleId(ipas);
  const apps: AltStoreApp[] = [];

  for (const [, bundleIpas] of grouped) {
    const latest = bundleIpas[0];
    const versions: AltStoreVersion[] = bundleIpas
      .slice(0, maxVersions)
      .map((ipa) => ({
        version: ipa.version,
        date: ipa.createdAt.toISOString().split("T")[0],
        size: Number(ipa.fileSize),
        downloadURL: ipa.downloadUrl || ipa.githubAssetUrl || "",
        localizedDescription: ipa.description || `${ipa.appName} v${ipa.version}`,
        minOSVersion: ipa.minOsVersion || undefined,
      }));

    const entitlements = (latest.entitlements as Record<string, string>) || {};
    const privacyInfo = (latest.privacyInfo as Record<string, string>) || {};

    apps.push({
      name: latest.appName,
      bundleIdentifier: latest.bundleId,
      developerName: latest.developerName || "Unknown Developer",
      subtitle: latest.isTweaked ? "Tweaked" : "",
      localizedDescription: latest.description || latest.appName,
      iconURL: latest.iconUrl || "",
      tintColor: config.source.tintColor,
      screenshotURLs: (latest.screenshotUrls as string[]) || [],
      versions,
      appPermissions: {
        entitlements: Object.keys(entitlements).map((name) => ({ name })),
        privacy: Object.entries(privacyInfo).map(([name, usageDescription]) => ({
          name,
          usageDescription,
        })),
      },
    });
  }

  const repo: AltStoreRepo = {
    name: config.source.name,
    subtitle: config.source.subtitle,
    description: config.source.description,
    iconURL: config.source.iconURL,
    headerURL: config.source.headerURL,
    website: config.source.website,
    tintColor: config.source.tintColor,
    featuredApps: config.source.featuredApps,
    apps,
    news: config.news,
  };

  return JSON.stringify(repo, null, 2);
}

function groupByBundleId(ipas: DownloadedIpa[]): Map<string, DownloadedIpa[]> {
  const grouped = new Map<string, DownloadedIpa[]>();
  // Sort by date descending within each bundle
  const sorted = [...ipas].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  for (const ipa of sorted) {
    const list = grouped.get(ipa.bundleId) || [];
    list.push(ipa);
    grouped.set(ipa.bundleId, list);
  }

  return grouped;
}
