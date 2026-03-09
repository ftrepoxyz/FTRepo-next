import { DownloadedIpa } from "@prisma/client";
import { TweakConfig } from "@/types/config";
import { AppNameOverrideMaps } from "./grouping";
import { generateAltStoreJson } from "./altstore";

/**
 * Generate Feather-format JSON (feather.json).
 * Feather natively supports AltStore repo format, so this is identical.
 */
export function generateFeatherJson(
  ipas: DownloadedIpa[],
  source: { name: string; iconURL?: string },
  maxVersions: number,
  knownTweaks: TweakConfig[],
  overrides?: AppNameOverrideMaps
): string {
  // Feather uses the same format as AltStore
  return generateAltStoreJson(
    ipas,
    source,
    maxVersions,
    knownTweaks,
    false,
    overrides,
    "feather"
  );
}
