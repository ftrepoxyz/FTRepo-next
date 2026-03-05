import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/auth";
import { getTelegramClient } from "@/lib/telegram/client";
import { getTelegramChannels, getSettings } from "@/lib/config";
import { scanChannelPrevious } from "@/lib/telegram/scanner";
import { startProcessing } from "@/lib/pipeline/orchestrator";

export const POST = withAuth(async () => {
  try {
    await logger.info("scan", "Scan Previous triggered via API");

    const client = await getTelegramClient();
    const channels = await getTelegramChannels();
    const settings = await getSettings();

    if (channels.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No active channels configured",
      });
    }

    let totalNew = 0;
    let totalIpa = 0;

    for (const channelId of channels) {
      const { newMessages, ipaMessages } = await scanChannelPrevious(
        client,
        channelId,
        settings.previous_ipa_scan_amount
      );
      totalNew += newMessages;
      totalIpa += ipaMessages;
    }

    await logger.success(
      "scan",
      `Scan Previous complete: ${totalNew} new messages, ${totalIpa} IPAs queued across ${channels.length} channel(s)`
    );

    startProcessing().catch((e) =>
      logger.error("process", "Background processing failed", {
        error: String(e),
      })
    );

    return NextResponse.json({
      success: true,
      message: `Scan Previous complete: ${totalNew} new messages, ${totalIpa} IPAs queued. Processing started.`,
      data: { newMessages: totalNew, ipaMessages: totalIpa, channelsScanned: channels.length },
    });
  } catch (e) {
    await logger.error("scan", "Scan Previous failed", { error: String(e) });
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});
