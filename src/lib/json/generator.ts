import { prisma } from "../db";
import { getSettings } from "../config";
import { logger } from "../logger";
import { generateAltStoreJson } from "./altstore";
import { generateESignJson } from "./esign";
import { generateScarletJson } from "./scarlet";
import { generateFeatherJson } from "./feather";
import { publishAllJsonFiles } from "../github/json-publisher";
import { groupByCompositeKey } from "./grouping";

export interface GenerationResult {
  altstore: string;
  esign: string;
  scarlet: string;
  feather: string;
  appCount: number;
  published: boolean;
}

/**
 * Generate all 4 JSON formats from the database and optionally publish to GitHub.
 */
export async function generateAllJson(
  publish: boolean = true
): Promise<GenerationResult> {
  const settings = await getSettings();
  const source = {
    name: settings.source_name,
    iconURL: settings.source_icon_url,
    tintColor: settings.source_tint_color,
  };
  const maxVersions = settings.max_versions_per_app;
  const knownTweaks = settings.known_tweaks;

  // Build channel priority map for tiebreaking
  const channelRows = await prisma.channelProgress.findMany({
    select: { channelId: true, priority: true },
  });
  const channelPriorities = new Map(
    channelRows.map((c) => [c.channelId, c.priority])
  );

  // Get all non-corrupted IPAs with download URLs
  const ipas = await prisma.downloadedIpa.findMany({
    where: {
      isCorrupted: false,
      OR: [
        { downloadUrl: { not: null } },
        { githubAssetUrl: { not: null } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  await logger.info("generate", `Generating JSON for ${ipas.length} IPAs`);

  const altstore = generateAltStoreJson(
    ipas,
    source,
    maxVersions,
    knownTweaks,
    true
  );
  const esign = generateESignJson(ipas, source, knownTweaks, channelPriorities);
  const scarlet = generateScarletJson(ipas, source, knownTweaks, channelPriorities);
  const feather = generateFeatherJson(ipas, source, maxVersions, knownTweaks);

  // Count unique apps using composite keys
  const compositeGroups = groupByCompositeKey(ipas, knownTweaks);
  const appCount = compositeGroups.size;

  let published = false;
  if (publish && settings.github_token) {
    try {
      await publishAllJsonFiles([
        { path: "store.json", content: altstore },
        { path: "esign.json", content: esign },
        { path: "scarlet.json", content: scarlet },
        { path: "feather.json", content: feather },
      ]);
      published = true;
      await logger.success("generate", `Published ${appCount} apps to all 4 JSON formats`);
    } catch (e) {
      await logger.error("generate", "Failed to publish JSON files", {
        error: String(e),
      });
    }
  }

  return {
    altstore,
    esign,
    scarlet,
    feather,
    appCount,
    published,
  };
}
