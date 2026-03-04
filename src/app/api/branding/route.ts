import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const rows = await prisma.setting.findMany({
      where: {
        key: { in: ["source_name", "source_description", "source_subtitle", "source_icon_url", "source_tint_color", "site_domain"] },
      },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return NextResponse.json(
      {
        source_name: map.source_name || "FTRepo",
        source_description: map.source_description || "Automated iOS IPA distribution",
        source_subtitle: map.source_subtitle || "iOS App Repository",
        source_icon_url: map.source_icon_url || "",
        source_tint_color: map.source_tint_color || "#5C7AEA",
        site_domain: map.site_domain || "",
      },
      {
        headers: { "Cache-Control": "public, max-age=60" },
      }
    );
  } catch {
    return NextResponse.json({
      source_name: "FTRepo",
      source_description: "Automated iOS IPA distribution",
      source_subtitle: "iOS App Repository",
      source_icon_url: "",
      source_tint_color: "#5C7AEA",
      site_domain: "",
    });
  }
}
