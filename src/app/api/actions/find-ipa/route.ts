import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/auth";
import { enqueueTelegramCommand } from "@/lib/telegram/client";

export const POST = withAuth(async (request, user) => {
  try {
    const body = (await request.json()) as { query?: unknown };
    const query = String(body.query ?? "").trim();

    if (!query) {
      return NextResponse.json(
        { success: false, error: "query is required" },
        { status: 400 }
      );
    }

    await logger.info("scan", "Find IPA triggered via API", { query });

    const { command, created } = await enqueueTelegramCommand({
      type: "search_ipa",
      payload: { query },
      requestedByUserId: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        accepted: true,
        created,
        commandId: command.id,
        message: created
          ? `IPA backfill queued for "${query}".`
          : "An IPA backfill job is already queued or running.",
      },
      { status: 202 }
    );
  } catch (e) {
    await logger.error("scan", "Find IPA failed", {
      error: String(e),
    });
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});
