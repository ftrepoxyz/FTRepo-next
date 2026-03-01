import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const corrupted = await prisma.downloadedIpa.findMany({
      where: { isCorrupted: true },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: corrupted.map((ipa) => ({
        ...ipa,
        fileSize: Number(ipa.fileSize),
        createdAt: ipa.createdAt.toISOString(),
        updatedAt: ipa.updatedAt.toISOString(),
      })),
    });
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
    const { id, isCorrupted, corruptionNote } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 }
      );
    }

    await prisma.downloadedIpa.update({
      where: { id },
      data: {
        isCorrupted: isCorrupted ?? true,
        corruptionNote: corruptionNote || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: isCorrupted ? "Marked as corrupted" : "Marked as not corrupted",
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
