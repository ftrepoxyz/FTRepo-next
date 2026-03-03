import { DownloadedIpa } from "@prisma/client";
import { FileConfig } from "@/types/config";
import { getLatestPerCompositeKey } from "./grouping";

interface ScarletRepo {
  META: {
    repoName: string;
    repoIcon: string;
  };
  data: ScarletApp[];
}

interface ScarletApp {
  name: string;
  version: string;
  down: string;
  category: string;
  bundleID: string;
  icon: string;
  description: string;
  developer: string;
  screenshots: string[];
  accentColor: {
    light: { red: number; green: number; blue: number };
  };
}

/**
 * Generate Scarlet-format JSON (scarlet.json).
 * Uses accentColor as RGB floats (0-1), categorized apps (Tweaked/Other).
 */
export function generateScarletJson(
  ipas: DownloadedIpa[],
  config: FileConfig,
  knownTweaks: string[]
): string {
  const latestByKey = getLatestPerCompositeKey(ipas, knownTweaks);
  const rgbColor = hexToRgbFloats(config.source.tintColor);
  const apps: ScarletApp[] = [];

  for (const ipa of latestByKey) {
    apps.push({
      name: ipa.appName,
      version: ipa.version,
      down: ipa.downloadUrl || ipa.githubAssetUrl || "",
      category: ipa.isTweaked ? "Tweaked" : "Other",
      bundleID: ipa.bundleId,
      icon: ipa.iconUrl || "",
      description: ipa.description || ipa.appName,
      developer: ipa.developerName || "Unknown Developer",
      screenshots: (ipa.screenshotUrls as string[]) || [],
      accentColor: {
        light: rgbColor,
      },
    });
  }

  const repo: ScarletRepo = {
    META: {
      repoName: config.source.name,
      repoIcon: config.source.iconURL,
    },
    data: apps,
  };

  return JSON.stringify(repo, null, 2);
}

/**
 * Convert hex color (#RRGGBB) to RGB floats in range 0-1 for Scarlet format.
 */
function hexToRgbFloats(hex: string): { red: number; green: number; blue: number } {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = parseInt(cleaned.substring(4, 6), 16) / 255;

  return {
    red: Math.round(r * 1000) / 1000,
    green: Math.round(g * 1000) / 1000,
    blue: Math.round(b * 1000) / 1000,
  };
}
