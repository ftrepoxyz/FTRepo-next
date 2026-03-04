import { DownloadedIpa } from "@prisma/client";
import { matchTweak } from "@/lib/ipa/tweak-matcher";
import type { TweakConfig } from "@/types/config";

/**
 * Group IPAs by composite key (bundleId::tweakName or just bundleId).
 * Used by AltStore/Feather generators that need multiple versions per group.
 * Returns entries sorted by date descending within each group.
 */
export function groupByCompositeKey(
  ipas: DownloadedIpa[],
  knownTweaks: TweakConfig[]
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
      knownTweaks,
      ipa.channelId
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
 *
 * When two IPAs share the same version+compositeKey, the one from the
 * higher-priority channel (lower priority number) wins as a tiebreaker.
 */
export function getLatestPerCompositeKey(
  ipas: DownloadedIpa[],
  knownTweaks: TweakConfig[],
  channelPriorities?: Map<string, number>
): DownloadedIpa[] {
  const map = new Map<string, DownloadedIpa>();

  for (const ipa of ipas) {
    const tweaks = (ipa.tweaks as string[]) || [];
    const { groupKey } = matchTweak(
      ipa.bundleId,
      ipa.appName,
      tweaks,
      ipa.isTweaked,
      knownTweaks,
      ipa.channelId
    );

    const existing = map.get(groupKey);
    if (!existing) {
      map.set(groupKey, ipa);
      continue;
    }

    // Latest version always wins
    if (ipa.createdAt > existing.createdAt) {
      map.set(groupKey, ipa);
    } else if (
      ipa.createdAt.getTime() === existing.createdAt.getTime() &&
      channelPriorities &&
      ipa.channelId &&
      existing.channelId
    ) {
      // Tiebreaker: prefer IPA from higher-priority channel (lower number)
      const ipaPriority = channelPriorities.get(ipa.channelId) ?? Infinity;
      const existingPriority = channelPriorities.get(existing.channelId) ?? Infinity;
      if (ipaPriority < existingPriority) {
        map.set(groupKey, ipa);
      }
    }
  }

  return Array.from(map.values());
}
