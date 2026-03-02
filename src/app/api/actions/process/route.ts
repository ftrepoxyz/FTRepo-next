import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/auth";
import { startProcessing } from "@/lib/pipeline/orchestrator";
import { getQueueStats } from "@/lib/pipeline/queue";

export const POST = withAuth(async () => {
  try {
    const stats = await getQueueStats();

    if (stats.pending === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending items in queue",
      });
    }

    await logger.info("process", `Manual process triggered — ${stats.pending} pending item(s)`);

    startProcessing().catch((e) =>
      logger.error("process", "Background processing failed", {
        error: String(e),
      })
    );

    return NextResponse.json({
      success: true,
      message: `Processing ${stats.pending} pending item(s). Check activity log for progress.`,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});
