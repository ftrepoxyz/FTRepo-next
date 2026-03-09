import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { getSettings } from "@/lib/config";
import { deleteReleaseAsset, getRelease, deleteRelease } from "@/lib/github/releases";
import { generateAllJson } from "@/lib/json/generator";
import { getVariantMeta, type RenameScope } from "@/lib/json/grouping";
import { logger } from "@/lib/logger";

interface Deletion {
  assetId: number;
  releaseId: number;
  dbId: number | null;
}

interface Rename {
  groupKey: string;
  bundleId: string;
  matchedTweak: string | null;
  scope: RenameScope;
  appName: string;
}

function buildApplyResponse(
  success: boolean,
  deletedCount: number,
  renamedCount: number,
  releasesCleanedUp: number,
  jsonPublished: boolean,
  message: string,
  error?: string,
  applied: boolean = false
) {
  return {
    success,
    ...(error && { error }),
    ...(applied && { applied: true }),
    message,
    data: {
      deletedCount,
      renamedCount,
      releasesCleanedUp,
      jsonPublished,
    },
  };
}

export const POST = withAuth(async (request) => {
  try {
    const { deletions = [], renames = [] }: {
      deletions: Deletion[];
      renames: Rename[];
    } = await request.json();

    if (deletions.length === 0 && renames.length === 0) {
      return NextResponse.json(
        { success: false, error: "No changes to apply" },
        { status: 400 }
      );
    }

    await logger.info(
      "cleanup",
      `Applying library changes: ${deletions.length} deletions, ${renames.length} renames`
    );

    let deletedCount = 0;
    let releasesCleanedUp = 0;

    if (deletions.length > 0) {
      const affectedReleaseIds = new Set<number>();

      for (const del of deletions) {
        try {
          await deleteReleaseAsset(del.assetId);
          affectedReleaseIds.add(del.releaseId);
          deletedCount++;
        } catch (e) {
          await logger.warn(
            "cleanup",
            `Failed to delete GitHub asset ${del.assetId}`,
            { error: String(e) }
          );
        }
      }

      for (const releaseId of affectedReleaseIds) {
        try {
          const release = await getRelease(releaseId);
          if (!release) continue;

          const hasIpaAssets = release.assets.some((asset) =>
            asset.name.toLowerCase().endsWith(".ipa")
          );
          if (!hasIpaAssets) {
            await deleteRelease(releaseId);
            releasesCleanedUp++;
          }
        } catch (e) {
          await logger.warn(
            "cleanup",
            `Failed to clean up release ${releaseId}`,
            { error: String(e) }
          );
        }
      }

      const dbIds = deletions
        .map((deletion) => deletion.dbId)
        .filter((id): id is number => id !== null);

      if (dbIds.length > 0) {
        await prisma.downloadedIpa.deleteMany({
          where: { id: { in: dbIds } },
        });
      }
    }

    let renamedCount = 0;
    if (renames.length > 0) {
      const settings = await getSettings();

      for (const rename of renames) {
        const appName = rename.appName.trim();
        if (!appName) continue;

        try {
          await prisma.feedAppOverride.upsert({
            where: {
              feed_groupKey: {
                feed: rename.scope,
                groupKey: rename.groupKey,
              },
            },
            update: {
              bundleId: rename.bundleId,
              matchedTweak: rename.matchedTweak,
              appName,
            },
            create: {
              feed: rename.scope,
              groupKey: rename.groupKey,
              bundleId: rename.bundleId,
              matchedTweak: rename.matchedTweak,
              appName,
            },
          });

          if (rename.scope === "global") {
            const bundleRows = await prisma.downloadedIpa.findMany({
              where: { bundleId: rename.bundleId },
              select: {
                id: true,
                bundleId: true,
                appName: true,
                tweaks: true,
                isTweaked: true,
                channelId: true,
              },
            });

            const matchingIds = bundleRows
              .filter((row) => {
                const tweaks = (row.tweaks as string[]) || [];
                return (
                  getVariantMeta(
                    row.bundleId,
                    row.appName,
                    tweaks,
                    row.isTweaked,
                    settings.known_tweaks,
                    row.channelId
                  ).groupKey === rename.groupKey
                );
              })
              .map((row) => row.id);

            if (matchingIds.length > 0) {
              await prisma.downloadedIpa.updateMany({
                where: { id: { in: matchingIds } },
                data: { appName },
              });
            }
          }

          renamedCount++;
        } catch (e) {
          await logger.warn("cleanup", `Failed to rename variant ${rename.groupKey}`, {
            error: String(e),
          });
        }
      }
    }

    const result = await generateAllJson(true);
    if (!result.published) {
      const error = "Changes were applied, but publishing the JSON source files did not complete";

      await logger.error("cleanup", error, {
        deletedCount,
        renamedCount,
        releasesCleanedUp,
      });

      return NextResponse.json(
        buildApplyResponse(
          false,
          deletedCount,
          renamedCount,
          releasesCleanedUp,
          false,
          error,
          error,
          true
        ),
        { status: 502 }
      );
    }

    await logger.success(
      "cleanup",
      `Library changes applied: ${deletedCount} deleted, ${renamedCount} renamed, ${releasesCleanedUp} empty releases cleaned up`,
      { deletedCount, renamedCount, releasesCleanedUp, jsonPublished: result.published }
    );

    return NextResponse.json({
      ...buildApplyResponse(
        true,
        deletedCount,
        renamedCount,
        releasesCleanedUp,
        true,
        `Applied ${deletedCount} deletions and ${renamedCount} renames`
      ),
    });
  } catch (e) {
    await logger.error("cleanup", "Failed to apply library changes", {
      error: String(e),
    });
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});
