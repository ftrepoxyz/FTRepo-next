import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCachedLookup } from "@/lib/appstore/cache";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 }
      );
    }

    const ipa = await prisma.downloadedIpa.findUnique({ where: { id } });
    if (!ipa) {
      return NextResponse.json(
        { success: false, error: "IPA not found" },
        { status: 404 }
      );
    }

    // Refresh App Store data
    const appStoreData = await getCachedLookup(ipa.bundleId);
    if (!appStoreData) {
      return NextResponse.json({
        success: false,
        error: "App not found on App Store",
      });
    }

    await prisma.downloadedIpa.update({
      where: { id },
      data: {
        iconUrl: appStoreData.iconUrl,
        screenshotUrls: appStoreData.screenshots,
        description: appStoreData.description,
        developerName: appStoreData.developer,
      },
    });

    await logger.success("process", `Refreshed App Store data for ${ipa.appName}`);

    return NextResponse.json({
      success: true,
      message: `Refreshed metadata for ${ipa.appName}`,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
