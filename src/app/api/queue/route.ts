import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getQueueStats } from "@/lib/pipeline/queue";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(100, parseInt(url.searchParams.get("pageSize") || "20"));

    const where = {
      hasIpa: true,
      ...(status && { status }),
    };

    const [total, items, stats] = await Promise.all([
      prisma.processedMessage.count({ where }),
      prisma.processedMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      getQueueStats(),
    ]);

    return NextResponse.json({
      success: true,
      data: items.map((item) => ({
        id: item.id,
        channelId: item.channelId,
        messageId: item.messageId,
        fileName: item.fileName,
        fileSize: item.fileSize ? Number(item.fileSize) : null,
        status: item.status,
        error: item.error,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      stats,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
