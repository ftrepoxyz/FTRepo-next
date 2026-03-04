import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function handleJsonRedirect(format: string) {
  try {
    const rows = await prisma.setting.findMany({
      where: {
        key: { in: ["github_owner", "github_repo", "github_branch"] },
      },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    const owner = map.github_owner || process.env.GITHUB_OWNER || "";
    const repo = map.github_repo || process.env.GITHUB_REPO || "";
    const branch = map.github_branch || process.env.GITHUB_BRANCH || "main";

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
