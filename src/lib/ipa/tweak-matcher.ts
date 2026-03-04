import type { TweakConfig } from "@/types/config";

export interface TweakMatch {
  groupKey: string;
  matchedTweak: string | null;
}

/**
 * Get all matchable names for a tweak (primary name + aliases).
 */
function getMatchNames(tweak: TweakConfig): string[] {
  return [tweak.name, ...(tweak.aliases || [])];
}

/**
 * Match an IPA to a known tweak name for composite grouping.
 *
 * - If not tweaked → returns bundleId as key, no match
 * - Checks dylib names (tweaks array) for case-insensitive exact match
 *   against tweak name AND aliases
 * - Falls back to checking appName for case-insensitive substring match
 *   against tweak name AND aliases
 * - Composite key format: `{bundleId}::{tweakName}` or just `{bundleId}`
 * - When matched via an alias, the tweak's primary name is used for grouping
 * - If a tweak is locked to a channel (lockedChannelId), it only matches
 *   IPAs from that channel
 */
export function matchTweak(
  bundleId: string,
  appName: string,
  tweaks: string[],
  isTweaked: boolean,
  knownTweaks: TweakConfig[],
  channelId?: string | null
): TweakMatch {
  if (!isTweaked) {
    return { groupKey: bundleId, matchedTweak: null };
  }

  // Filter out tweaks locked to a different channel
  const applicableTweaks = knownTweaks.filter(
    (t) => !t.lockedChannelId || t.lockedChannelId === channelId
  );

  // Sort by longest match name descending (more specific names match first)
  const sorted = [...applicableTweaks].sort((a, b) => {
    const aMax = Math.max(...getMatchNames(a).map((n) => n.length));
    const bMax = Math.max(...getMatchNames(b).map((n) => n.length));
    return bMax - aMax;
  });

  // First: check tweaks array (dylib names) for case-insensitive exact match
  for (const known of sorted) {
    for (const matchName of getMatchNames(known)) {
      const matchLower = matchName.toLowerCase();
      for (const dylib of tweaks) {
        if (dylib.toLowerCase() === matchLower) {
          return { groupKey: `${bundleId}::${known.name}`, matchedTweak: known.name };
        }
      }
    }
  }

  // Second: check appName for case-insensitive substring match
  const appNameLower = appName.toLowerCase();
  for (const known of sorted) {
    for (const matchName of getMatchNames(known)) {
      if (appNameLower.includes(matchName.toLowerCase())) {
        return { groupKey: `${bundleId}::${known.name}`, matchedTweak: known.name };
      }
    }
  }

  // No match — use bundleId only
  return { groupKey: bundleId, matchedTweak: null };
}
