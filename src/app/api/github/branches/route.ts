import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { getSettings } from "@/lib/config";
import { withAuth } from "@/lib/auth";

export const GET = withAuth(async () => {
  try {
    const settings = await getSettings();
    const token = settings.github_token;
    const owner = settings.github_owner;
    const repo = settings.github_repo;

    if (!token || !owner || !repo) {
      return NextResponse.json(
        { success: false, error: "GitHub token, owner, or repo not configured" },
        { status: 400 }
      );
    }

    const octokit = new Octokit({ auth: token });
    const branches: string[] = [];
    let page = 1;

    while (branches.length < 200) {
      const res = await octokit.repos.listBranches({
        owner,
        repo,
        per_page: 100,
        page,
      });
      for (const b of res.data) {
        branches.push(b.name);
      }
      if (res.data.length < 100) break;
      page++;
    }

    return NextResponse.json({ success: true, data: branches });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
});
