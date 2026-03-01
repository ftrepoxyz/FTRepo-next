import { NextResponse } from "next/server";
import { clearAllCache, clearExpiredCache } from "@/lib/appstore/cache";

export async function DELETE() {
  try {
    const cleared = await clearAllCache();
    return NextResponse.json({
      success: true,
      data: { cleared },
      message: `Cleared ${cleared} cache entries`,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const cleared = await clearExpiredCache();
    return NextResponse.json({
      success: true,
      data: { cleared },
      message: `Cleared ${cleared} expired cache entries`,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
