import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // Get currently active transfers (downloading/processing)
    const active = await prisma.processedMessage.findMany({
      where: {
        status: { in: ["downloading", "processing"] },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: active.map((t) => ({
        id: t.id,
        channelId: t.channelId,
        messageId: Number(t.messageId),
        fileName: t.fileName,
        fileSize: t.fileSize ? Number(t.fileSize) : null,
        status: t.status,
        updatedAt: t.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
