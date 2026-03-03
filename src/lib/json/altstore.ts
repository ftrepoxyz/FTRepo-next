import { DownloadedIpa } from "@prisma/client";
import { AltStoreApp, AltStoreVersion, FileConfig } from "@/types/config";

interface AltStoreRepo {
  name: string;
  identifier: string;
  apps: AltStoreApp[];
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
      }));

    const latestVersion = versions[0];

    apps.push({
      name: latest.appName,
      bundleIdentifier: latest.bundleId,
      developerName: latest.developerName || "Unknown Developer",
      iconURL: latest.iconUrl || "",
      localizedDescription: latest.description || latest.appName,
      versions,
      appPermissions: {},
      version: latestVersion.version,
      versionDate: latest.createdAt.toISOString(),
      size: latestVersion.size,
      downloadURL: latestVersion.downloadURL,
    });
  }

  const repo: AltStoreRepo = {
    name: config.source.name,
    identifier: "xyz.ftrepo",
    apps,
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
