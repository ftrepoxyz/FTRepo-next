import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { listReleases } from "@/lib/github/releases";
import { logger } from "@/lib/logger";

/**
 * Parse an IPA asset filename to extract bundleId and version.
 * Format: `${bundleId}${tweakSlug}_${version}.ipa`
 * Examples:
 *   com.app.bundle_1.0.ipa          -> { bundleId: "com.app.bundle", version: "1.0" }
 *   com.app.bundle_TweakName_1.0.ipa -> { bundleId: "com.app.bundle", version: "1.0" }
 */
function parseAssetName(name: string): { bundleId: string; version: string } | null {
  if (!name.toLowerCase().endsWith(".ipa")) return null;

  const withoutExt = name.slice(0, -4); // strip ".ipa"
  const lastUnderscore = withoutExt.lastIndexOf("_");
  if (lastUnderscore === -1) return null;

  const version = withoutExt.slice(lastUnderscore + 1);
  const prefix = withoutExt.slice(0, lastUnderscore);

  // prefix might be "bundleId" or "bundleId_tweakSlug"
  // bundleId always looks like "com.x.y" (has dots), tweakSlug doesn't
  // We want the longest leading dot-containing segment
  const parts = prefix.split("_");
  let bundleIdParts: string[] = [];
  for (const part of parts) {
    if (part.includes(".") || bundleIdParts.length === 0) {
      bundleIdParts.push(part);
    } else {
      break;
    }
  }

  const bundleId = bundleIdParts.join("_");
  return { bundleId, version };
}

export const GET = withAuth(async () => {
  try {
    // Fetch all releases from GitHub
    const releases = await listReleases();

    // Extract all IPA assets across all releases
    const ipaAssets: {
      assetId: number;
      assetName: string;
      downloadUrl: string;
      size: number;
      releaseId: number;
      releaseTag: string;
    }[] = [];

    for (const release of releases) {
      for (const asset of release.assets) {
        if (asset.name.toLowerCase().endsWith(".ipa")) {
          ipaAssets.push({
            assetId: asset.id,
            assetName: asset.name,
            downloadUrl: asset.downloadUrl,
            size: asset.size,
            releaseId: release.id,
            releaseTag: release.tagName,
          });
        }
      }
    }

    // Cross-reference with database records for metadata
    // Build a lookup by githubAssetId
    const assetIds = ipaAssets.map((a) => a.assetId);
    const dbRecords = assetIds.length > 0
      ? await prisma.downloadedIpa.findMany({
          where: { githubAssetId: { in: assetIds } },
        })
      : [];

    const dbByAssetId = new Map(
      dbRecords.map((r) => [r.githubAssetId!, r])
    );

    // Build the library items
    const items = ipaAssets.map((asset) => {
      const db = dbByAssetId.get(asset.assetId);
      const parsed = parseAssetName(asset.assetName);

      return {
        assetId: asset.assetId,
        assetName: asset.assetName,
        downloadUrl: asset.downloadUrl,
        size: asset.size,
        releaseId: asset.releaseId,
        releaseTag: asset.releaseTag,
        dbId: db?.id ?? null,
        appName: db?.appName ?? parsed?.bundleId ?? asset.assetName,
        bundleId: db?.bundleId ?? parsed?.bundleId ?? "",
        version: db?.version ?? parsed?.version ?? "",
        isTweaked: db?.isTweaked ?? false,
        channelId: db?.channelId ?? null,
        fileSize: db ? Number(db.fileSize) : asset.size,
        createdAt: db?.createdAt?.toISOString() ?? "",
      };
    });

    // Collect distinct channels for filter dropdown
    const channelSet = new Set<string>();
    for (const item of items) {
      if (item.channelId) channelSet.add(item.channelId);
    }

    return NextResponse.json({
      success: true,
      data: items,
      channels: Array.from(channelSet).sort(),
    });
  } catch (e) {
    await logger.error("system", "Failed to fetch library", {
      error: String(e),
    });
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});
