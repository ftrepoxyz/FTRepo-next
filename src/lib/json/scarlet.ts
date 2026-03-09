import { DownloadedIpa } from "@prisma/client";
import { TweakConfig } from "@/types/config";
import { enhanceAppleScreenshotUrls } from "../appstore/images";
import {
  AppNameOverrideMaps,
  getLatestPerCompositeKey,
  resolveDisplayName,
} from "./grouping";

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
  source: { name: string; iconURL: string; tintColor: string },
  knownTweaks: TweakConfig[],
  channelPriorities?: Map<string, number>,
  overrides?: AppNameOverrideMaps
): string {
  const latestByKey = getLatestPerCompositeKey(ipas, knownTweaks, channelPriorities);
  const rgbColor = hexToRgbFloats(source.tintColor);
  const apps: ScarletApp[] = [];

  for (const { ipa, matchedTweak, groupKey } of latestByKey) {
    const displayName = resolveDisplayName({
      appName: ipa.appName,
      groupKey,
      matchedTweak,
      overrides,
      feed: "global",
    });
    apps.push({
      name: displayName,
      version: ipa.version,
      down: ipa.downloadUrl || ipa.githubAssetUrl || "",
      category: ipa.isTweaked ? "Tweaked" : "Other",
      bundleID: ipa.bundleId,
      icon: ipa.iconUrl || "",
      description: ipa.description || ipa.appName,
      developer: ipa.developerName || "Unknown Developer",
      screenshots: enhanceAppleScreenshotUrls(ipa.screenshotUrls),
      accentColor: {
        light: rgbColor,
      },
    });
  }

  const repo: ScarletRepo = {
    META: {
      repoName: source.name,
      repoIcon: source.iconURL,
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
