import { DownloadedIpa } from "@prisma/client";
import { TweakConfig } from "@/types/config";
import { generateAltStoreJson } from "./altstore";

/**
 * Generate Feather-format JSON (feather.json).
 * Feather natively supports AltStore repo format, so this is identical.
 */
export function generateFeatherJson(
  ipas: DownloadedIpa[],
  source: { name: string },
  maxVersions: number,
  knownTweaks: TweakConfig[]
): string {
  // Feather uses the same format as AltStore
  return generateAltStoreJson(ipas, source, maxVersions, knownTweaks);
}
