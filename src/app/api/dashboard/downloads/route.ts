import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // Get recent downloads (IPAs processed in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentDownloads = await prisma.downloadedIpa.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        appName: true,
        version: true,
        bundleId: true,
        fileSize: true,
        isTweaked: true,
        channelId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: recentDownloads.map((d) => ({
        ...d,
        fileSize: Number(d.fileSize),
        createdAt: d.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
