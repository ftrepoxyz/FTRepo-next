import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";

export const PUT = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { channelIds } = body;

    if (!Array.isArray(channelIds) || channelIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "channelIds array is required" },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      channelIds.map((channelId: string, index: number) =>
        prisma.channelProgress.update({
          where: { channelId },
          data: { priority: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});
