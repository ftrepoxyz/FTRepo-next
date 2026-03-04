import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { resolveChannelInfo } from "@/lib/telegram/channel-info";
import type { ChannelProgress } from "@prisma/client";

function serializeChannel(c: ChannelProgress) {
  return {
    id: c.id,
    channelId: c.channelId,
    channelName: c.channelName,
    channelDescription: c.channelDescription,
    isActive: c.isActive,
    isForum: c.isForum,
    forumTopics: c.forumTopics ?? [],
    priority: c.priority,
    lastMessageId: Number(c.lastMessageId),
    totalMessages: c.totalMessages,
    ipaCount: c.ipaCount,
    lastScannedAt: c.lastScannedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

export const GET = withAuth(async () => {
  try {
    const channels = await prisma.channelProgress.findMany({
      orderBy: { priority: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: channels.map(serializeChannel),
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { channelId, channelName } = body;

    if (!channelId) {
      return NextResponse.json(
        { success: false, error: "channelId is required" },
        { status: 400 }
      );
    }

    const maxPriority = await prisma.channelProgress.aggregate({
      _max: { priority: true },
    });
    const nextPriority = (maxPriority._max.priority ?? -1) + 1;

    let channel = await prisma.channelProgress.create({
      data: {
        channelId,
        channelName: channelName || channelId,
        priority: nextPriority,
      },
    });

    // Try to fetch title & description from Telegram
    await resolveChannelInfo(channelId);
    channel = await prisma.channelProgress.findUniqueOrThrow({
      where: { channelId },
    });

    return NextResponse.json({ success: true, data: serializeChannel(channel) }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { channelId, isActive, channelName, forumTopics, priority } = body;

    if (!channelId) {
      return NextResponse.json(
        { success: false, error: "channelId is required" },
        { status: 400 }
      );
    }

    const channel = await prisma.channelProgress.update({
      where: { channelId },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(channelName && { channelName }),
        ...(forumTopics !== undefined && { forumTopics }),
        ...(priority !== undefined && { priority }),
      },
    });

    return NextResponse.json({ success: true, data: serializeChannel(channel) });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (request) => {
  try {
    const url = new URL(request.url);
    const channelId = url.searchParams.get("channelId");

    if (!channelId) {
      return NextResponse.json(
        { success: false, error: "channelId is required" },
        { status: 400 }
      );
    }

    await prisma.channelProgress.delete({ where: { channelId } });

    return NextResponse.json({
      success: true,
      message: `Channel ${channelId} removed`,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});
