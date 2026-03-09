import { NextResponse } from "next/server";
import { getSettingsOrDefaults } from "@/lib/config";

export async function GET() {
  const settings = await getSettingsOrDefaults();

  return NextResponse.json(
    {
      source_name: settings.source_name,
      source_description: settings.source_description,
      source_subtitle: settings.source_subtitle,
      source_icon_url: settings.source_icon_url,
      source_tint_color: settings.source_tint_color,
      site_domain: settings.site_domain,
    },
    {
      headers: { "Cache-Control": "public, max-age=60" },
    }
  );
}
