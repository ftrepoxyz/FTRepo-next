import { NextResponse } from "next/server";
import { generateAllJson } from "@/lib/json/generator";

export async function POST() {
  try {
    const result = await generateAllJson(true);

    return NextResponse.json({
      success: true,
      data: {
        appCount: result.appCount,
        published: result.published,
      },
      message: `Generated JSON for ${result.appCount} apps`,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
