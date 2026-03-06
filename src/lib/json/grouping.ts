import { DownloadedIpa } from "@prisma/client";
import { matchTweak } from "@/lib/ipa/tweak-matcher";
import type { TweakConfig } from "@/types/config";

export interface GroupedIpas {
  ipas: DownloadedIpa[];
  matchedTweak: string | null;
}

/**
 * Build a display name by appending the matched tweak name if not already present.
 */
export function buildDisplayName(appName: string, matchedTweak: string | null): string {
  if (!matchedTweak) return appName;
  if (appName.toLowerCase().includes(matchedTweak.toLowerCase())) return appName;
  if (matchedTweak.toLowerCase().includes(appName.toLowerCase())) return matchedTweak;
  return `${appName} ${matchedTweak}`;
}

/**
 * Group IPAs by composite key (bundleId::tweakName or just bundleId).
 * Used by AltStore/Feather generators that need multiple versions per group.
 * Returns entries sorted by date descending within each group.
 */
export function groupByCompositeKey(
  ipas: DownloadedIpa[],
  knownTweaks: TweakConfig[]
): Map<string, GroupedIpas> {
  const sorted = [...ipas].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  const grouped = new Map<string, GroupedIpas>();

  for (const ipa of sorted) {
    const tweaks = (ipa.tweaks as string[]) || [];
    const { groupKey, matchedTweak } = matchTweak(
      ipa.bundleId,
      ipa.appName,
      tweaks,
      ipa.isTweaked,
      knownTweaks,
      ipa.channelId
    );

    const existing = grouped.get(groupKey);
    if (existing) {
      existing.ipas.push(ipa);
    } else {
      grouped.set(groupKey, { ipas: [ipa], matchedTweak });
    }
  }

  return grouped;
}

export interface LatestIpaWithTweak {
  ipa: DownloadedIpa;
  matchedTweak: string | null;
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
): LatestIpaWithTweak[] {
  const map = new Map<string, LatestIpaWithTweak>();

  for (const ipa of ipas) {
    const tweaks = (ipa.tweaks as string[]) || [];
    const { groupKey, matchedTweak } = matchTweak(
      ipa.bundleId,
      ipa.appName,
      tweaks,
      ipa.isTweaked,
      knownTweaks,
      ipa.channelId
    );

    const existing = map.get(groupKey);
    if (!existing) {
      map.set(groupKey, { ipa, matchedTweak });
      continue;
    }

    // Latest version always wins
    if (ipa.createdAt > existing.ipa.createdAt) {
      map.set(groupKey, { ipa, matchedTweak });
    } else if (
      ipa.createdAt.getTime() === existing.ipa.createdAt.getTime() &&
      channelPriorities &&
      ipa.channelId &&
      existing.ipa.channelId
    ) {
      // Tiebreaker: prefer IPA from higher-priority channel (lower number)
      const ipaPriority = channelPriorities.get(ipa.channelId) ?? Infinity;
      const existingPriority = channelPriorities.get(existing.ipa.channelId) ?? Infinity;
      if (ipaPriority < existingPriority) {
        map.set(groupKey, { ipa, matchedTweak });
      }
    }
  }

  return Array.from(map.values());
}
