import { prisma } from "@/lib/db";
import { hashPassword, createSession, jsonNoStore } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return jsonNoStore(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    if (username.length < 3 || username.length > 32) {
      return jsonNoStore(
        { error: "Username must be 3-32 characters" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return jsonNoStore(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return jsonNoStore(
        { error: "Username can only contain letters, numbers, hyphens, and underscores" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return jsonNoStore(
        { error: "Username already taken" },
        { status: 409 }
      );
    }

    // Use transaction to prevent race condition on first-user detection
    const user = await prisma.$transaction(async (tx) => {
      const userCount = await tx.user.count();
      const isFirstUser = userCount === 0;

      return tx.user.create({
        data: {
          username,
          passwordHash: hashPassword(password),
          role: "admin",
          approved: isFirstUser,
        },
      });
    });

    if (user.approved) {
      await createSession(user.id);
      return jsonNoStore({
        success: true,
        user: { id: user.id, username: user.username, role: user.role, approved: user.approved },
      });
    }

    return jsonNoStore({
      success: true,
      pendingApproval: true,
      message: "Account created. An admin must approve your account before you can log in.",
    });
  } catch (e) {
    return jsonNoStore(
      { error: String(e) },
      { status: 500 }
    );
  }
}
