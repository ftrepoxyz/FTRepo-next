import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ids } = body as { action: string; ids: number[] };

    if (!action || !ids?.length) {
      return NextResponse.json(
        { success: false, error: "action and ids[] are required" },
        { status: 400 }
      );
    }

    let count = 0;

    switch (action) {
      case "retry": {
        const result = await prisma.processedMessage.updateMany({
          where: { id: { in: ids }, status: "failed" },
          data: { status: "pending", error: null },
        });
        count = result.count;
        break;
      }
      case "delete": {
        const result = await prisma.processedMessage.deleteMany({
          where: { id: { in: ids } },
        });
        count = result.count;
        break;
      }
      case "skip": {
        const result = await prisma.processedMessage.updateMany({
          where: { id: { in: ids } },
          data: { status: "skipped" },
        });
        count = result.count;
        break;
      }
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `${action} applied to ${count} items`,
      data: { count },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
