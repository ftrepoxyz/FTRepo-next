import { NextResponse } from "next/server";
import { cleanupReleases } from "@/lib/github/cleanup";
import { cleanupOldLogs } from "@/lib/cleanup/logs";
import { cleanupCaches } from "@/lib/cleanup/cache";

export async function POST() {
  try {
    const [releases, logs, caches] = await Promise.all([
      cleanupReleases(),
      cleanupOldLogs(),
      cleanupCaches(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        deletedReleases: releases.deletedReleases,
        freedBytes: releases.freedBytes,
        deletedLogs: logs,
        expiredCacheEntries: caches.expiredAppStore,
      },
      message: "Cleanup completed",
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
