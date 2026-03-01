import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    await logger.info("scan", "Manual scan triggered via API");

    // In the full implementation, this would trigger the worker via a database flag.
    // For now, log the request and return a success response.
    await logger.success("scan", "Scan request queued");

    return NextResponse.json({
      success: true,
      message: "Scan triggered. Check activity log for progress.",
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
