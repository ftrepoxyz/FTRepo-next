import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings, invalidateSettingsCache } from "@/lib/config";
import { withAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const GET = withAuth(async () => {
  try {
    const settings = await getSettings();
    return NextResponse.json({
      success: true,
      enabled: settings.system_enabled,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const enabled = Boolean(body.enabled);

    await prisma.setting.upsert({
      where: { key: "system_enabled" },
      update: { value: String(enabled) },
      create: { key: "system_enabled", value: String(enabled), type: "boolean" },
    });

    invalidateSettingsCache();

    await logger.info(
      "system",
      enabled ? "System started by user" : "System stopped by user"
    );

    return NextResponse.json({ success: true, enabled });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});
