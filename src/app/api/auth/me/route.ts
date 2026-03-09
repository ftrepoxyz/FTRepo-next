import { getCurrentUser, jsonNoStore } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser({ clearInvalidCookie: true });

    if (!user) {
      return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
    }

    return jsonNoStore({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        approved: user.approved,
      },
    });
  } catch (e) {
    return jsonNoStore(
      { error: String(e) },
      { status: 500 }
    );
  }
}
