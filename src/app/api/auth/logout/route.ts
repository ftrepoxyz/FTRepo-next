import { deleteSession, jsonNoStore } from "@/lib/auth";

export async function POST() {
  try {
    await deleteSession();
    return jsonNoStore({ success: true });
  } catch (e) {
    return jsonNoStore(
      { error: String(e) },
      { status: 500 }
    );
  }
}
