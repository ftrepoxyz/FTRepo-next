import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/config";

export async function GET() {
  try {
    const settings = await getSettings();
    const [
      totalIpas,
      totalDownloads,
      activeChannels,
      pendingQueue,
    ] = await Promise.all([
      prisma.downloadedIpa.count(),
      prisma.downloadedIpa.aggregate({ _sum: { downloadCount: true } }),
      prisma.channelProgress.count({ where: { isActive: true } }),
      prisma.processedMessage.count({
        where: { status: "pending", hasIpa: true },
      }),
    ]);

    // Calculate storage used
    const storageResult = await prisma.downloadedIpa.aggregate({
      _sum: { fileSize: true },
    });
    const storageUsed = Number(storageResult._sum.fileSize || 0);

    // Get last scan time
    const lastScan = await prisma.activityLog.findFirst({
      where: { type: "scan", status: "success" },
      orderBy: { createdAt: "desc" },
    });

    // Get last JSON generation time
    const lastJsonGen = await prisma.activityLog.findFirst({
      where: { type: "generate", status: "success" },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: {
        totalIpas,
        totalDownloads: totalDownloads._sum.downloadCount || 0,
        storageUsed,
        activeChannels,
        queueDepth: pendingQueue,
        workerStatus: settings.system_enabled ? "running" : "stopped",
        lastScanAt: lastScan?.createdAt.toISOString(),
        lastJsonGenAt: lastJsonGen?.createdAt.toISOString(),
        uptime: process.uptime(),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
