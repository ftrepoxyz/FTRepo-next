import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAdmin } from "@/lib/auth";

export const GET = withAdmin(async () => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      approved: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ success: true, data: users });
});

export const PUT = withAdmin(async (req) => {
  const { id, approved } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (approved !== undefined) data.approved = approved;

  const updated = await prisma.user.update({
    where: { id },
    select: {
      id: true,
      username: true,
      role: true,
      approved: true,
      createdAt: true,
      updatedAt: true,
    },
    data,
  });

  // If user was unapproved, delete their sessions
  if (approved === false) {
    await prisma.session.deleteMany({ where: { userId: id } });
  }

  return NextResponse.json({ success: true, data: updated });
});

export const DELETE = withAdmin(async (req, currentUser) => {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));

  if (!id) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  if (id === currentUser.id) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ success: true });
});
