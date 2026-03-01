import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const channels = await prisma.channelProgress.findMany({
      orderBy: { channelId: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: channels.map((c) => ({
        id: c.id,
        channelId: c.channelId,
        channelName: c.channelName,
        isActive: c.isActive,
        lastMessageId: c.lastMessageId,
        totalMessages: c.totalMessages,
        ipaCount: c.ipaCount,
        lastScannedAt: c.lastScannedAt?.toISOString(),
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { channelId, channelName } = body;

    if (!channelId) {
      return NextResponse.json(
        { success: false, error: "channelId is required" },
        { status: 400 }
      );
    }

    const channel = await prisma.channelProgress.create({
      data: {
        channelId,
        channelName: channelName || channelId,
      },
    });

    return NextResponse.json({ success: true, data: channel }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { channelId, isActive, channelName } = body;

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
      },
    });

    return NextResponse.json({ success: true, data: channel });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
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
}
