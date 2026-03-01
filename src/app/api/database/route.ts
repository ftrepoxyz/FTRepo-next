import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(100, parseInt(url.searchParams.get("pageSize") || "20"));
    const search = url.searchParams.get("search") || "";
    const bundleId = url.searchParams.get("bundleId") || "";
    const tweaked = url.searchParams.get("tweaked");
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
    };

    const [total, ipas] = await Promise.all([
      prisma.downloadedIpa.count({ where }),
      prisma.downloadedIpa.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
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
    });
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

    return NextResponse.json({ success: true, data: ipa });
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
}
