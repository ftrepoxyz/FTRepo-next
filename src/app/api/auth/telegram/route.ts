import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import {
  getTelegramAuthStatus,
  startTelegramAuth,
  submitAuthCode,
  submitAuthPassword,
  closeTelegramClient,
  resetTelegramClient,
} from "@/lib/telegram/client";
import { getSettings } from "@/lib/config";

export const GET = withAuth(async () => {
  let status = getTelegramAuthStatus();

  // Auto-reconnect using existing session if credentials are configured
  if (status.state === "disconnected") {
    const settings = await getSettings();
    if (
      settings.telegram_api_id &&
      settings.telegram_api_hash &&
      settings.telegram_phone
    ) {
      await startTelegramAuth();
      status = getTelegramAuthStatus();
    }
  }

  return NextResponse.json({ success: true, ...status });
});

export const POST = withAuth(async (request) => {
  const body = await request.json();
  const { action, code, password } = body;

  try {
    switch (action) {
      case "connect":
        await startTelegramAuth();
        break;
      case "code":
        if (!code)
          return NextResponse.json(
            { success: false, error: "Code is required" },
            { status: 400 }
          );
        await submitAuthCode(String(code));
        break;
      case "password":
        if (!password)
          return NextResponse.json(
            { success: false, error: "Password is required" },
            { status: 400 }
          );
        await submitAuthPassword(String(password));
        break;
      case "disconnect":
        await closeTelegramClient();
        break;
      case "reset":
        await resetTelegramClient();
        break;
      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }

    const status = getTelegramAuthStatus();
    return NextResponse.json({ success: true, ...status });
  } catch (e) {
    const status = getTelegramAuthStatus();
    return NextResponse.json({ success: false, ...status, error: String(e) });
  }
});
