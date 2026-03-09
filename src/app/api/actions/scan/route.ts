import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/auth";
import { enqueueTelegramCommand } from "@/lib/telegram/client";
import { getTelegramChannels } from "@/lib/config";

export const POST = withAuth(async (_request, user) => {
  try {
    await logger.info("scan", "Manual scan triggered via API");

    const channels = await getTelegramChannels();

    if (channels.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No active channels configured",
      });
    }

    const { command, created } = await enqueueTelegramCommand({
      type: "scan_now",
      requestedByUserId: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        accepted: true,
        created,
        commandId: command.id,
        message: created
          ? `Scan queued across ${channels.length} channel(s).`
          : "A scan is already queued or running.",
      },
      { status: 202 }
    );
  } catch (e) {
    await logger.error("scan", "Manual scan failed", { error: String(e) });
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});
