import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ids, status } = body as {
      action: string;
      ids?: number[];
      status?: string;
    };

    if (!action) {
      return NextResponse.json(
        { success: false, error: "action is required" },
        { status: 400 }
      );
    }

    let count = 0;

    switch (action) {
      case "retry": {
        if (!ids?.length) {
          return NextResponse.json(
            { success: false, error: "ids[] is required for retry" },
            { status: 400 }
          );
        }

        const result = await prisma.processedMessage.updateMany({
          where: { id: { in: ids }, status: "failed" },
          data: { status: "pending", error: null },
        });
        count = result.count;
        break;
      }
      case "delete": {
        if (status) {
          const result = await prisma.processedMessage.deleteMany({
            where: { status, hasIpa: true },
          });
          count = result.count;
          break;
        }

        if (!ids?.length) {
          return NextResponse.json(
            { success: false, error: "ids[] or status is required for delete" },
            { status: 400 }
          );
        }

        const result = await prisma.processedMessage.deleteMany({
          where: { id: { in: ids } },
        });
        count = result.count;
        break;
      }
      case "skip": {
        if (!ids?.length) {
          return NextResponse.json(
            { success: false, error: "ids[] is required for skip" },
            { status: 400 }
          );
        }

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
      message: status
        ? `${action} applied to ${count} ${status} items`
        : `${action} applied to ${count} items`,
      data: { count },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
