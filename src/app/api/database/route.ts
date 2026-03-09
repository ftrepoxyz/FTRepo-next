import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";

export const GET = withAuth(async (request) => {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(100, parseInt(url.searchParams.get("pageSize") || "20"));
    const search = url.searchParams.get("search") || "";
    const bundleId = url.searchParams.get("bundleId") || "";
    const tweaked = url.searchParams.get("tweaked");
    const channelId = url.searchParams.get("channelId") || "";
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortOrder = url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const where = {
      ...(search && {
        OR: [
          { appName: { contains: search, mode: "insensitive" as const } },
          { bundleId: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(bundleId && { bundleId }),
      ...(tweaked !== null && tweaked !== undefined && { isTweaked: tweaked === "true" }),
      ...(channelId && { channelId }),
    };

    const [total, ipas, channelRows] = await Promise.all([
      prisma.downloadedIpa.count({ where }),
      prisma.downloadedIpa.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.downloadedIpa.findMany({
        where: { channelId: { not: null } },
        distinct: ["channelId"],
        select: { channelId: true },
        orderBy: { channelId: "asc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: ipas.map((ipa) => ({
        ...ipa,
        fileSize: Number(ipa.fileSize),
        createdAt: ipa.createdAt.toISOString(),
        updatedAt: ipa.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      channels: channelRows.map((c) => c.channelId).filter(Boolean),
    });
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
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 }
      );
    }

    const ipa = await prisma.downloadedIpa.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...ipa,
        fileSize: Number(ipa.fileSize),
        messageId: ipa.messageId != null ? Number(ipa.messageId) : null,
        createdAt: ipa.createdAt.toISOString(),
        updatedAt: ipa.updatedAt.toISOString(),
      },
    });
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
    const id = parseInt(url.searchParams.get("id") || "");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 }
      );
    }

    await prisma.downloadedIpa.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "IPA entry deleted",
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});
