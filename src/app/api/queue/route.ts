import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getQueueStats } from "@/lib/pipeline/queue";
import { withAuth } from "@/lib/auth";

export const GET = withAuth(async (request) => {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search") || "";
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortOrder = url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(100, parseInt(url.searchParams.get("pageSize") || "20"));

    const where = {
      hasIpa: true,
      ...(status && { status }),
      ...(search && {
        fileName: { contains: search, mode: "insensitive" as const },
      }),
    };

    const [total, items, stats] = await Promise.all([
      prisma.processedMessage.count({ where }),
      prisma.processedMessage.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
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
        messageId: Number(item.messageId),
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
});
