import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { deleteReleaseAsset, getRelease, deleteRelease } from "@/lib/github/releases";
import { generateAllJson } from "@/lib/json/generator";
import { logger } from "@/lib/logger";

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
      deletions: number[];
      renames: { id: number; appName: string }[];
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

    // Phase 1: Process deletions
    if (deletions.length > 0) {
      const ipasToDelete = await prisma.downloadedIpa.findMany({
        where: { id: { in: deletions } },
        select: { id: true, appName: true, githubAssetId: true, githubReleaseId: true },
      });

      // Track affected releases to check if they become empty
      const affectedReleaseIds = new Set<number>();

      for (const ipa of ipasToDelete) {
        if (ipa.githubAssetId) {
          try {
            await deleteReleaseAsset(ipa.githubAssetId);
            if (ipa.githubReleaseId) {
              affectedReleaseIds.add(ipa.githubReleaseId);
            }
          } catch (e) {
            await logger.warn(
              "cleanup",
              `Failed to delete asset ${ipa.githubAssetId} for ${ipa.appName}`,
              { error: String(e) }
            );
          }
        } else if (ipa.githubReleaseId) {
          try {
            await deleteRelease(ipa.githubReleaseId);
            releasesCleanedUp++;
          } catch (e) {
            await logger.warn(
              "cleanup",
              `Failed to delete legacy release ${ipa.githubReleaseId} for ${ipa.appName}`,
              { error: String(e) }
            );
          }
        }
      }

      // Clean up empty releases
      for (const releaseId of affectedReleaseIds) {
        try {
          const release = await getRelease(releaseId);
          if (!release) continue;

          const hasIpaAssets = release.assets.some((a) =>
            a.name.toLowerCase().endsWith(".ipa")
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

      // Delete IPAs from database
      const deleteResult = await prisma.downloadedIpa.deleteMany({
        where: { id: { in: deletions } },
      });
      deletedCount = deleteResult.count;
    }

    // Phase 2: Process renames
    let renamedCount = 0;
    if (renames.length > 0) {
      for (const { id, appName } of renames) {
        try {
          await prisma.downloadedIpa.update({
            where: { id },
            data: { appName },
          });
          renamedCount++;
        } catch (e) {
          await logger.warn("cleanup", `Failed to rename IPA ${id}`, {
            error: String(e),
          });
        }
      }
    }

    // Phase 3: Regenerate and publish all JSON source files
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
