import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const entries = await prisma.privacyDescriptionCache.findMany({
      orderBy: { usageCount: "desc" },
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
        { success: false, error: "key and description are required" },
        { status: 400 }
      );
    }

    const entry = await prisma.privacyDescriptionCache.upsert({
      where: { key },
      update: { description },
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

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { key, description } = body;

    if (!key) {
      return NextResponse.json(
        { success: false, error: "key is required" },
        { status: 400 }
      );
    }

    const entry = await prisma.privacyDescriptionCache.update({
      where: { key },
      data: { description },
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

    if (!key) {
      return NextResponse.json(
        { success: false, error: "key is required" },
        { status: 400 }
      );
    }

    await prisma.privacyDescriptionCache.delete({ where: { key } });

    return NextResponse.json({
      success: true,
      message: `Entitlement ${key} deleted`,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
