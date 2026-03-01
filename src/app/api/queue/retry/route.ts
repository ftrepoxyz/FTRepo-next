import { NextResponse } from "next/server";
import { retryFailed, retryAllFailed } from "@/lib/pipeline/queue";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, all } = body;

    if (all) {
      const count = await retryAllFailed();
      return NextResponse.json({
        success: true,
        message: `Retried ${count} failed items`,
        data: { count },
      });
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id or all=true is required" },
        { status: 400 }
      );
    }

    await retryFailed(id);
    return NextResponse.json({
      success: true,
      message: `Retried item ${id}`,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
