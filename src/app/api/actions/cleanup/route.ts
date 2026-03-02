import { NextResponse } from "next/server";
import { cleanupReleases } from "@/lib/github/cleanup";
import { cleanupOldLogs } from "@/lib/cleanup/logs";
import { cleanupCaches } from "@/lib/cleanup/cache";
import { cleanupExpiredSessions } from "@/lib/cleanup/sessions";
import { withAuth } from "@/lib/auth";

export const POST = withAuth(async () => {
  try {
    const [releases, logs, caches, sessions] = await Promise.all([
      cleanupReleases(),
      cleanupOldLogs(),
      cleanupCaches(),
      cleanupExpiredSessions(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        deletedReleases: releases.deletedReleases,
        freedBytes: releases.freedBytes,
        deletedLogs: logs,
        expiredCacheEntries: caches.expiredAppStore,
        expiredSessions: sessions,
      },
      message: "Cleanup completed",
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});
