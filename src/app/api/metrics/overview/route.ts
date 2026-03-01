import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const [totalIpas, downloadSum, activeChannels, storageSum] =
      await Promise.all([
        prisma.downloadedIpa.count(),
        prisma.downloadedIpa.aggregate({ _sum: { downloadCount: true } }),
        prisma.channelProgress.count({ where: { isActive: true } }),
        prisma.downloadedIpa.aggregate({ _sum: { fileSize: true } }),
      ]);

    // Success rate
    const [completed, failed] = await Promise.all([
      prisma.processedMessage.count({ where: { status: "completed" } }),
      prisma.processedMessage.count({ where: { status: "failed" } }),
    ]);
    const total = completed + failed;
    const successRate = total > 0 ? (completed / total) * 100 : 100;

    // Downloads by day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentIpas = await prisma.downloadedIpa.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const downloadsByDay = new Map<string, number>();
    for (const ipa of recentIpas) {
      const date = ipa.createdAt.toISOString().split("T")[0];
      downloadsByDay.set(date, (downloadsByDay.get(date) || 0) + 1);
    }

    // IPAs by channel
    const ipasByChannel = await prisma.downloadedIpa.groupBy({
      by: ["channelId"],
      _count: true,
      where: { channelId: { not: null } },
    });

    // Storage by app (top 10)
    const storageByApp = await prisma.downloadedIpa.groupBy({
      by: ["appName"],
      _sum: { fileSize: true },
      orderBy: { _sum: { fileSize: "desc" } },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      data: {
        totalIpas,
        totalDownloads: downloadSum._sum.downloadCount || 0,
        storageUsedBytes: Number(storageSum._sum.fileSize || 0),
        activeChannels,
        successRate: Math.round(successRate * 10) / 10,
        downloadsByDay: Array.from(downloadsByDay.entries()).map(
          ([date, count]) => ({ date, count })
        ),
        ipasByChannel: ipasByChannel.map((c) => ({
          channel: c.channelId || "unknown",
          count: c._count,
        })),
        storageByApp: storageByApp.map((s) => ({
          app: s.appName,
          sizeBytes: Number(s._sum.fileSize || 0),
        })),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
