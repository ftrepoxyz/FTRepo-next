import { DownloadedIpa } from "@prisma/client";
import { matchTweak } from "@/lib/ipa/tweak-matcher";
import type { TweakConfig } from "@/types/config";

export type RenameScope = "global" | "feather";

export interface AppNameOverrideMaps {
  global: Map<string, string>;
  feather: Map<string, string>;
}

/**
 * Compare two version strings numerically (e.g. "5.45.0" > "5.44.0").
 * Falls back to lexicographic comparison for non-numeric segments.
 * Returns positive if a > b, negative if a < b, 0 if equal.
 */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".");
  const pb = b.split(".");
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = parseInt(pa[i] ?? "0", 10);
    const nb = parseInt(pb[i] ?? "0", 10);
    if (isNaN(na) || isNaN(nb)) {
      const cmp = (pa[i] ?? "").localeCompare(pb[i] ?? "");
      if (cmp !== 0) return cmp;
    } else if (na !== nb) {
      return na - nb;
    }
  }
  return 0;
}

export interface GroupedIpas {
  groupKey: string;
  ipas: DownloadedIpa[];
  matchedTweak: string | null;
}

export interface VariantMeta {
  groupKey: string;
  matchedTweak: string | null;
  renameScope: RenameScope;
}

export function getRenameScope(matchedTweak: string | null): RenameScope {
  return matchedTweak ? "feather" : "global";
}

export function getVariantMeta(
  bundleId: string,
  appName: string,
  tweaks: string[],
  isTweaked: boolean,
  knownTweaks: TweakConfig[],
  channelId?: string | null
): VariantMeta {
  const { groupKey, matchedTweak } = matchTweak(
    bundleId,
    appName,
    tweaks,
    isTweaked,
    knownTweaks,
    channelId
  );

  return {
    groupKey,
    matchedTweak,
    renameScope: getRenameScope(matchedTweak),
  };
}

export function buildAppNameOverrideMaps(
  overrides: { feed: string; groupKey: string; appName: string }[]
): AppNameOverrideMaps {
  const maps: AppNameOverrideMaps = {
    global: new Map<string, string>(),
    feather: new Map<string, string>(),
  };

  for (const override of overrides) {
    if (override.feed === "global" || override.feed === "feather") {
      maps[override.feed].set(override.groupKey, override.appName);
    }
  }

  return maps;
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

export function resolveDisplayName(params: {
  appName: string;
  groupKey: string;
  matchedTweak: string | null;
  overrides?: AppNameOverrideMaps;
  feed: "global" | "feather" | "library";
  publishedName?: string | null;
}): string {
  const {
    appName,
    groupKey,
    matchedTweak,
    overrides,
    feed,
    publishedName,
  } = params;

  const baseName = buildDisplayName(appName, matchedTweak);
  const globalOverride = overrides?.global.get(groupKey);
  const featherOverride = overrides?.feather.get(groupKey);

  if (feed === "global") {
    return globalOverride ?? baseName;
  }

  if (feed === "feather") {
    return globalOverride ?? featherOverride ?? publishedName ?? baseName;
  }

  return globalOverride ?? featherOverride ?? publishedName ?? baseName;
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
    (a, b) =>
      compareVersions(b.version, a.version) ||
      b.createdAt.getTime() - a.createdAt.getTime()
  );

  const grouped = new Map<string, GroupedIpas>();

  for (const ipa of sorted) {
    const tweaks = (ipa.tweaks as string[]) || [];
    const { groupKey, matchedTweak } = getVariantMeta(
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
      grouped.set(groupKey, { groupKey, ipas: [ipa], matchedTweak });
    }
  }

  // Deduplicate by version within each group (keep the latest per version).
  // Since ipas are sorted by createdAt desc, the first seen is the most recent.
  for (const [, group] of grouped) {
    const seen = new Set<string>();
    group.ipas = group.ipas.filter((ipa) => {
      if (seen.has(ipa.version)) return false;
      seen.add(ipa.version);
      return true;
    });
  }

  return grouped;
}

export interface LatestIpaWithTweak {
  groupKey: string;
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
    const { groupKey, matchedTweak } = getVariantMeta(
      ipa.bundleId,
      ipa.appName,
      tweaks,
      ipa.isTweaked,
      knownTweaks,
      ipa.channelId
    );

    const existing = map.get(groupKey);
    if (!existing) {
      map.set(groupKey, { groupKey, ipa, matchedTweak });
      continue;
    }

    const versionCmp = compareVersions(ipa.version, existing.ipa.version);

    if (versionCmp > 0) {
      // Higher version number always wins
      map.set(groupKey, { groupKey, ipa, matchedTweak });
    } else if (versionCmp === 0) {
      // Same version: prefer newer upload, then higher-priority channel
      if (ipa.createdAt > existing.ipa.createdAt) {
        map.set(groupKey, { groupKey, ipa, matchedTweak });
      } else if (
        ipa.createdAt.getTime() === existing.ipa.createdAt.getTime() &&
        channelPriorities &&
        ipa.channelId &&
        existing.ipa.channelId
      ) {
        const ipaPriority = channelPriorities.get(ipa.channelId) ?? Infinity;
        const existingPriority = channelPriorities.get(existing.ipa.channelId) ?? Infinity;
        if (ipaPriority < existingPriority) {
          map.set(groupKey, { groupKey, ipa, matchedTweak });
        }
      }
    }
  }

  return Array.from(map.values());
}
