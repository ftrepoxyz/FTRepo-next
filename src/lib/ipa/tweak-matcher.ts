export interface TweakMatch {
  groupKey: string;
  matchedTweak: string | null;
}

/**
 * Match an IPA to a known tweak name for composite grouping.
 *
 * - If not tweaked → returns bundleId as key, no match
 * - Checks dylib names (tweaks array) for case-insensitive exact match
 * - Falls back to checking appName for case-insensitive substring match
 * - Composite key format: `{bundleId}::{tweakName}` or just `{bundleId}`
 */
export function matchTweak(
  bundleId: string,
  appName: string,
  tweaks: string[],
  isTweaked: boolean,
  knownTweaks: string[]
): TweakMatch {
  if (!isTweaked) {
    return { groupKey: bundleId, matchedTweak: null };
  }

  // Sort known tweaks by length descending (longer/more specific names match first)
  const sorted = [...knownTweaks].sort((a, b) => b.length - a.length);

  // First: check tweaks array (dylib names) for case-insensitive exact match
  for (const known of sorted) {
    const knownLower = known.toLowerCase();
    for (const dylib of tweaks) {
      if (dylib.toLowerCase() === knownLower) {
        return { groupKey: `${bundleId}::${known}`, matchedTweak: known };
      }
    }
  }

  // Second: check appName for case-insensitive substring match
  const appNameLower = appName.toLowerCase();
  for (const known of sorted) {
    if (appNameLower.includes(known.toLowerCase())) {
      return { groupKey: `${bundleId}::${known}`, matchedTweak: known };
    }
  }

  // No match — use bundleId only
  return { groupKey: bundleId, matchedTweak: null };
}
