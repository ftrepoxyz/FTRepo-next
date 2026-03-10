import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { listReleases, deleteRelease, deleteTag } from "@/lib/github/releases";
import { deleteJsonFile } from "@/lib/github/json-publisher";
import { withAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";

const JSON_FILES = ["store.json", "esign.json", "scarlet.json", "feather.json"];

export const POST = withAuth(async () => {
  try {
    await logger.warn("system", "Nuke initiated — deleting all data, GitHub releases, tags, and JSON files");

    // 1. Delete all GitHub releases and their tags
    let releasesDeleted = 0;
    let tagsDeleted = 0;
    try {
      const releases = await listReleases();
      for (const release of releases) {
        try {
          await deleteRelease(release.id);
          releasesDeleted++;
        } catch (e) {
          await logger.error("system", `Failed to delete release ${release.tagName}`, {
            error: String(e),
          });
        }
        // Delete the tag left behind after release deletion
        try {
          await deleteTag(release.tagName);
          tagsDeleted++;
        } catch (e) {
          await logger.error("system", `Failed to delete tag ${release.tagName}`, {
            error: String(e),
          });
        }
      }
    } catch (e) {
      await logger.error("system", "Failed to list GitHub releases for deletion", {
        error: String(e),
      });
    }

    // 2. Delete JSON files from the repository
    let jsonFilesDeleted = 0;
    for (const file of JSON_FILES) {
      try {
        await deleteJsonFile(file);
        jsonFilesDeleted++;
      } catch (e) {
        await logger.error("system", `Failed to delete ${file} from repository`, {
          error: String(e),
        });
      }
    }

    // 3. Wipe database tables
    const [queueResult, ipasResult] = await Promise.all([
      prisma.processedMessage.deleteMany(),
      prisma.downloadedIpa.deleteMany(),
    ]);

    // 4. Reset channel progress (keep channels but reset scan cursors)
    await prisma.channelProgress.updateMany({
      data: {
        lastMessageId: BigInt(0),
        previousScanMessageId: BigInt(0),
        totalMessages: 0,
        ipaCount: 0,
      },
    });

    const message = `Nuke complete: ${releasesDeleted} releases deleted, ${tagsDeleted} tags deleted, ${jsonFilesDeleted} JSON files removed, ${queueResult.count} queue entries removed, ${ipasResult.count} IPAs removed`;
    await logger.success("system", message);

    return NextResponse.json({ success: true, message });
  } catch (e) {
    await logger.error("system", "Nuke failed", { error: String(e) });
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});
