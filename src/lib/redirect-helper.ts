import { NextResponse } from "next/server";
import { getSettingsOrDefaults } from "@/lib/config";

export async function handleJsonRedirect(format: string) {
  try {
    const settings = await getSettingsOrDefaults();

    const owner = settings.github_owner || process.env.GITHUB_OWNER || "";
    const repo = settings.github_repo || process.env.GITHUB_REPO || "";
    const branch = settings.github_branch || process.env.GITHUB_BRANCH || "main";

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "GitHub not configured" },
        { status: 503 }
      );
    }

    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${format}.json`;

    // Proxy the JSON directly instead of redirecting, so signers that
    // don't follow redirects (e.g. Feather) can parse the response.
    const upstream = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const body = await upstream.text();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "GitHub not configured" },
      { status: 503 }
    );
  }
}
