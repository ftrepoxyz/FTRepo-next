import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/auth";
import { getQueueStats } from "@/lib/pipeline/queue";
import { enqueueTelegramCommand } from "@/lib/telegram/client";

export const POST = withAuth(async (_request, user) => {
  try {
    const stats = await getQueueStats();

    if (stats.pending === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending items in queue",
      });
    }

    await logger.info("process", `Manual process triggered — ${stats.pending} pending item(s)`);

    const { command, created } = await enqueueTelegramCommand({
      type: "process_queue",
      requestedByUserId: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        accepted: true,
        created,
        commandId: command.id,
        message: created
          ? `Processing ${stats.pending} pending item(s).`
          : "Queue processing is already queued or running.",
      },
      { status: 202 }
    );
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});
