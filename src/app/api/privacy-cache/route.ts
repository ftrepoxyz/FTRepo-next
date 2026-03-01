import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const entries = await prisma.privacyDescriptionCache.findMany({
      orderBy: { key: "asc" },
    });

    return NextResponse.json({ success: true, data: entries });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, description } = body;

    if (!key || !description) {
      return NextResponse.json(
        { success: false, error: "key and description required" },
        { status: 400 }
      );
    }

    const entry = await prisma.privacyDescriptionCache.upsert({
      where: { key },
      update: { description, usageCount: { increment: 1 } },
      create: { key, description },
    });

    return NextResponse.json({ success: true, data: entry });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (key) {
      await prisma.privacyDescriptionCache.delete({ where: { key } });
      return NextResponse.json({ success: true, message: "Entry deleted" });
    }

    // Clear all
    const result = await prisma.privacyDescriptionCache.deleteMany();
    return NextResponse.json({
      success: true,
      message: `Cleared ${result.count} entries`,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
