import { withAuth, jsonNoStore } from "@/lib/auth";
import { getTelegramCommandById } from "@/lib/telegram/client";

export const GET = withAuth(async (request) => {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const id = Number(segments[segments.length - 1]);

  if (!Number.isInteger(id) || id <= 0) {
    return jsonNoStore(
      { success: false, error: "Invalid command id" },
      { status: 400 }
    );
  }

  const command = await getTelegramCommandById(id);
  if (!command) {
    return jsonNoStore(
      { success: false, error: "Command not found" },
      { status: 404 }
    );
  }

  return jsonNoStore({
    success: true,
    data: {
      id: command.id,
      type: command.type,
      status: command.status,
      payload: command.payload,
      result: command.result,
      error: command.error,
      requestedAt: command.requestedAt.toISOString(),
      startedAt: command.startedAt?.toISOString() ?? null,
      completedAt: command.completedAt?.toISOString() ?? null,
      createdAt: command.createdAt.toISOString(),
      updatedAt: command.updatedAt.toISOString(),
    },
  });
});
