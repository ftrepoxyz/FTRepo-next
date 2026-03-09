import { prisma } from "@/lib/db";
import { verifyPassword, createSession, jsonNoStore } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return jsonNoStore(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return jsonNoStore(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    if (!user.approved) {
      return jsonNoStore(
        { error: "Your account is pending admin approval" },
        { status: 403 }
      );
    }

    await createSession(user.id);

    return jsonNoStore({
      success: true,
      user: { id: user.id, username: user.username, role: user.role, approved: user.approved },
    });
  } catch (e) {
    return jsonNoStore(
      { error: String(e) },
      { status: 500 }
    );
  }
}
