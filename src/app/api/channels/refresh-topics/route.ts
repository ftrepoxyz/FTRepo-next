import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { enqueueTelegramCommand } from "@/lib/telegram/client";

export const POST = withAuth(async (request, user) => {
  try {
    const body = await request.json();
    const { channelId } = body;

    if (!channelId) {
      return NextResponse.json(
        { success: false, error: "channelId is required" },
        { status: 400 }
      );
    }

    const channel = await prisma.channelProgress.findUnique({
      where: { channelId },
      select: { channelId: true, isForum: true, forumTopics: true },
    });

    if (!channel) {
      return NextResponse.json(
        { success: false, error: "Channel not found" },
        { status: 404 }
      );
    }

    const { command, created } = await enqueueTelegramCommand({
      type: "refresh_topics",
      payload: { channelId },
      requestedByUserId: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        accepted: true,
        created,
        commandId: command.id,
        data: {
          isForum: channel.isForum,
          forumTopics: channel.forumTopics ?? [],
        },
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
