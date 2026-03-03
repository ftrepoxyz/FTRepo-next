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
    return NextResponse.redirect(url, 302);
  } catch {
    return NextResponse.json(
      { error: "GitHub not configured" },
      { status: 503 }
    );
  }
}
