import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { invalidateSettingsCache } from "@/lib/config";
import { withAuth } from "@/lib/auth";

const SENSITIVE_KEYS = new Set([
  "github_token",
]);

const MASK = "••••••••";

export const GET = withAuth(async () => {
  try {
    const settings = await prisma.setting.findMany({
      orderBy: { key: "asc" },
    });

    const result: Record<string, string | number | boolean> = {};
    for (const s of settings) {
      if (SENSITIVE_KEYS.has(s.key) && s.value) {
        result[s.key] = MASK;
        continue;
      }

      switch (s.type) {
        case "number":
          result[s.key] = parseFloat(s.value);
          break;
        case "boolean":
          result[s.key] = s.value === "true";
          break;
        case "json":
          try {
            result[s.key] = JSON.parse(s.value);
          } catch {
            result[s.key] = s.value;
          }
          break;
        default:
          result[s.key] = s.value;
      }
    }

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (request) => {
  try {
    const body = (await request.json()) as Record<string, string | number | boolean>;

    for (const [key, value] of Object.entries(body)) {
      // Skip updates where value equals the mask placeholder
      if (value === MASK) continue;

      const type =
        typeof value === "number"
          ? "number"
          : typeof value === "boolean"
            ? "boolean"
            : "string";

      await prisma.setting.upsert({
        where: { key },
        update: { value: String(value), type },
        create: { key, value: String(value), type },
      });
    }

    invalidateSettingsCache();

    return NextResponse.json({
      success: true,
      message: "Settings updated",
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});
