import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import {
  getTelegramAuthStatus,
  enqueueTelegramCommand,
} from "@/lib/telegram/client";

export const GET = withAuth(async () => {
  return NextResponse.json({ success: true, ...(await getTelegramAuthStatus()) });
});

export const POST = withAuth(async (request, user) => {
  const body = await request.json();
  const { action, code, password } = body;

  try {
    const currentStatus = await getTelegramAuthStatus();
    let type:
      | "connect"
      | "submit_code"
      | "submit_password"
      | "disconnect"
      | "reset_session";
    let payload: Record<string, unknown> | undefined;

    switch (action) {
      case "connect":
        if (
          currentStatus.state === "waiting_code" ||
          currentStatus.state === "waiting_password"
        ) {
          return NextResponse.json(
            {
              success: false,
              accepted: false,
              ...currentStatus,
              error: "Telegram authentication is already waiting for input.",
            },
            { status: 409 }
          );
        }
        type = "connect";
        break;
      case "code":
        if (!code)
          return NextResponse.json(
            { success: false, error: "Code is required" },
            { status: 400 }
          );
        if (currentStatus.state !== "waiting_code") {
          return NextResponse.json(
            {
              success: false,
              accepted: false,
              ...currentStatus,
              error: "Telegram is not waiting for a verification code.",
            },
            { status: 409 }
          );
        }
        type = "submit_code";
        payload = { code: String(code) };
        break;
      case "password":
        if (!password)
          return NextResponse.json(
            { success: false, error: "Password is required" },
            { status: 400 }
          );
        if (currentStatus.state !== "waiting_password") {
          return NextResponse.json(
            {
              success: false,
              accepted: false,
              ...currentStatus,
              error: "Telegram is not waiting for a 2FA password.",
            },
            { status: 409 }
          );
        }
        type = "submit_password";
        payload = { password: String(password) };
        break;
      case "disconnect":
        type = "disconnect";
        break;
      case "reset":
        type = "reset_session";
        break;
      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }

    const { command, created } = await enqueueTelegramCommand({
      type,
      payload,
      requestedByUserId: user.id,
    });
    const status = await getTelegramAuthStatus();

    return NextResponse.json(
      {
        success: true,
        accepted: true,
        created,
        commandId: command.id,
        ...status,
      },
      { status: 202 }
    );
  } catch (e) {
    const status = await getTelegramAuthStatus();
    return NextResponse.json(
      { success: false, accepted: false, ...status, error: String(e) },
      { status: 500 }
    );
  }
});
