import { DownloadedIpa } from "@prisma/client";
import { FileConfig } from "@/types/config";
import { generateAltStoreJson } from "./altstore";

/**
 * Generate Feather-format JSON (feather.json).
 * Feather natively supports AltStore repo format, so this is identical.
 */
export function generateFeatherJson(
  ipas: DownloadedIpa[],
  config: FileConfig,
  maxVersions: number,
  knownTweaks: string[]
): string {
  // Feather uses the same format as AltStore
  return generateAltStoreJson(ipas, config, maxVersions, knownTweaks);
}
