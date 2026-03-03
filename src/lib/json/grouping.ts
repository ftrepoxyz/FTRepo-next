import { DownloadedIpa } from "@prisma/client";
import { matchTweak } from "@/lib/ipa/tweak-matcher";

/**
 * Group IPAs by composite key (bundleId::tweakName or just bundleId).
 * Used by AltStore/Feather generators that need multiple versions per group.
 * Returns entries sorted by date descending within each group.
 */
export function groupByCompositeKey(
  ipas: DownloadedIpa[],
  knownTweaks: string[]
): Map<string, DownloadedIpa[]> {
  const sorted = [...ipas].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  const grouped = new Map<string, DownloadedIpa[]>();

  for (const ipa of sorted) {
    const tweaks = (ipa.tweaks as string[]) || [];
    const { groupKey } = matchTweak(
      ipa.bundleId,
      ipa.appName,
      tweaks,
      ipa.isTweaked,
      knownTweaks
    );

    const list = grouped.get(groupKey) || [];
    list.push(ipa);
    grouped.set(groupKey, list);
  }

  return grouped;
}

/**
 * Get the latest IPA per composite key.
 * Used by ESign/Scarlet generators that show only one version per app.
 */
export function getLatestPerCompositeKey(
  ipas: DownloadedIpa[],
  knownTweaks: string[]
): DownloadedIpa[] {
  const map = new Map<string, DownloadedIpa>();

  for (const ipa of ipas) {
    const tweaks = (ipa.tweaks as string[]) || [];
    const { groupKey } = matchTweak(
      ipa.bundleId,
      ipa.appName,
      tweaks,
      ipa.isTweaked,
      knownTweaks
    );

    const existing = map.get(groupKey);
    if (!existing || ipa.createdAt > existing.createdAt) {
      map.set(groupKey, ipa);
    }
  }

  return Array.from(map.values());
}
