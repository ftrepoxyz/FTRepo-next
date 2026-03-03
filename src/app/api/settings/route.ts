import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { invalidateSettingsCache, DEFAULT_KNOWN_TWEAKS } from "@/lib/config";
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

    const result: Record<string, unknown> = {};
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

    // Fill in defaults for settings not yet in the DB
    if (!("known_tweaks" in result)) {
      result.known_tweaks = DEFAULT_KNOWN_TWEAKS;
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
    const body = (await request.json()) as Record<string, unknown>;

    for (const [key, value] of Object.entries(body)) {
      // Skip updates where value equals the mask placeholder
      if (value === MASK) continue;

      let type: string;
      let stored: string;

      if (typeof value === "object" && value !== null) {
        type = "json";
        stored = JSON.stringify(value);
      } else if (typeof value === "number") {
        type = "number";
        stored = String(value);
      } else if (typeof value === "boolean") {
        type = "boolean";
        stored = String(value);
      } else {
        type = "string";
        stored = String(value);
      }

      await prisma.setting.upsert({
        where: { key },
        update: { value: stored, type },
        create: { key, value: stored, type },
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
