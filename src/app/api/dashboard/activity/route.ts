import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search") || "";
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortOrder = url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(100, parseInt(url.searchParams.get("pageSize") || "20"));

    const where = {
      ...(type && { type }),
      ...(status && { status }),
      ...(search && {
        message: { contains: search, mode: "insensitive" as const },
      }),
    };

    const [total, activities, statsRaw] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.activityLog.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
    ]);

    const stats: Record<string, number> = {};
    for (const row of statsRaw) {
      stats[row.status] = row._count.status;
    }

    return NextResponse.json({
      success: true,
      data: activities.map((a) => ({
        id: a.id,
        type: a.type,
        message: a.message,
        status: a.status,
        details: a.details,
        createdAt: a.createdAt.toISOString(),
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
