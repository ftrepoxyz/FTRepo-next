import { DownloadedIpa } from "@prisma/client";
import { AltStoreApp, AltStoreVersion, TweakConfig } from "@/types/config";
import { groupByCompositeKey, buildDisplayName } from "./grouping";

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
  source: { name: string; iconURL?: string },
  maxVersions: number,
  knownTweaks: TweakConfig[],
  dedupeBundleIdentifiers: boolean = false
): string {
  const grouped = groupByCompositeKey(ipas, knownTweaks);
  const apps: AltStoreApp[] = [];
  const seenBundleIds = new Set<string>();

  for (const [, { ipas: bundleIpas, matchedTweak }] of grouped) {
    const latest = bundleIpas[0];

    if (dedupeBundleIdentifiers && seenBundleIds.has(latest.bundleId)) {
      continue;
    }

    const displayName = buildDisplayName(latest.appName, matchedTweak);
    const versions: AltStoreVersion[] = bundleIpas
      .slice(0, maxVersions)
      .map((ipa) => ({
        version: ipa.version,
        date: ipa.createdAt.toISOString().split("T")[0],
        size: Number(ipa.fileSize),
        downloadURL: ipa.downloadUrl || ipa.githubAssetUrl || null,
      }));

    const latestVersion = versions[0];

    apps.push({
      name: displayName,
      bundleIdentifier: latest.bundleId,
      developerName: latest.developerName || "Unknown Developer",
      iconURL: latest.iconUrl || source.iconURL || "https://placehold.co/128",
      localizedDescription: latest.description || latest.appName,
      versions,
      appPermissions: {},
      version: latestVersion.version,
      versionDate: latest.createdAt.toISOString(),
      size: latestVersion.size,
      downloadURL: latestVersion.downloadURL,
    });

    if (dedupeBundleIdentifiers) {
      seenBundleIds.add(latest.bundleId);
    }
  }

  const repo: AltStoreRepo = {
    name: source.name,
    identifier: `xyz.${source.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
    apps,
  };

  return JSON.stringify(repo, null, 2);
}
