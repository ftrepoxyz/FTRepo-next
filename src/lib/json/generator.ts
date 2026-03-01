import { prisma } from "../db";
import { getConfig } from "../config";
import { logger } from "../logger";
import { generateAltStoreJson } from "./altstore";
import { generateESignJson } from "./esign";
import { generateScarletJson } from "./scarlet";
import { generateFeatherJson } from "./feather";
import { publishAllJsonFiles } from "../github/json-publisher";

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
  const config = getConfig();
  const maxVersions = config.env.MAX_VERSIONS_PER_APP;

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

  const altstore = generateAltStoreJson(ipas, config, maxVersions);
  const esign = generateESignJson(ipas, config);
  const scarlet = generateScarletJson(ipas, config);
  const feather = generateFeatherJson(ipas, config, maxVersions);

  // Count unique apps
  const uniqueBundles = new Set(ipas.map((i) => i.bundleId));

  let published = false;
  if (publish && config.env.GITHUB_TOKEN) {
    try {
      await publishAllJsonFiles([
        { path: "store.json", content: altstore },
        { path: "esign.json", content: esign },
        { path: "scarlet.json", content: scarlet },
        { path: "feather.json", content: feather },
      ]);
      published = true;
      await logger.success("generate", `Published ${uniqueBundles.size} apps to all 4 JSON formats`);
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
    appCount: uniqueBundles.size,
    published,
  };
}
