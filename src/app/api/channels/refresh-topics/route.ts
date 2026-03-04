import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { resolveChannelInfo } from "@/lib/telegram/channel-info";

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { channelId } = body;

    if (!channelId) {
      return NextResponse.json(
        { success: false, error: "channelId is required" },
        { status: 400 }
      );
    }

    // Re-fetch channel info (includes forum detection + topic merge)
    await resolveChannelInfo(channelId);

    const channel = await prisma.channelProgress.findUnique({
      where: { channelId },
      select: { isForum: true, forumTopics: true },
    });

    if (!channel) {
      return NextResponse.json(
        { success: false, error: "Channel not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        isForum: channel.isForum,
        forumTopics: channel.forumTopics ?? [],
      },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});
