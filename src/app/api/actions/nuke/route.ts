import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { listReleases, deleteRelease } from "@/lib/github/releases";
import { withAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const POST = withAuth(async () => {
  try {
    await logger.warn("system", "Nuke initiated — deleting all data and GitHub releases");

    // 1. Delete all GitHub releases
    let releasesDeleted = 0;
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
      }
    } catch (e) {
      await logger.error("system", "Failed to list GitHub releases for deletion", {
        error: String(e),
      });
    }

    // 2. Wipe database tables
    const [queueResult, ipasResult] = await Promise.all([
      prisma.processedMessage.deleteMany(),
      prisma.downloadedIpa.deleteMany(),
    ]);

    // 3. Reset channel progress (keep channels but reset scan cursors)
    await prisma.channelProgress.updateMany({
      data: {
        lastMessageId: BigInt(0),
        totalMessages: 0,
        ipaCount: 0,
      },
    });

    const message = `Nuke complete: ${releasesDeleted} releases deleted, ${queueResult.count} queue entries removed, ${ipasResult.count} IPAs removed`;
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
