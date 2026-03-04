import { DownloadedIpa } from "@prisma/client";
import { AltStoreApp, AltStoreVersion, FileConfig, TweakConfig } from "@/types/config";
import { groupByCompositeKey } from "./grouping";

interface AltStoreRepo {
  name: string;
  identifier: string;
  apps: AltStoreApp[];
}

/**
 * Generate AltStore-format JSON (store.json).
 * Apps are grouped by composite key (bundleId::tweak), with multiple versions per app.
 */
export function generateAltStoreJson(
  ipas: DownloadedIpa[],
  config: FileConfig,
  maxVersions: number,
  knownTweaks: TweakConfig[]
): string {
  const grouped = groupByCompositeKey(ipas, knownTweaks);
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
    identifier: `xyz.${config.source.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
    apps,
  };

  return JSON.stringify(repo, null, 2);
}
