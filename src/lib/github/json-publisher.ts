import { Octokit } from "@octokit/rest";
import { getConfig } from "../config";

let octokit: Octokit | null = null;

function getOctokit(): Octokit {
  if (!octokit) {
    const token = getConfig().env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN not configured");
    octokit = new Octokit({ auth: token });
  }
  return octokit;
}

/**
 * Publish a JSON file to the repository via the GitHub Contents API.
 */
export async function publishJsonFile(
  path: string,
  content: string,
  commitMessage: string
): Promise<void> {
  const ok = getOctokit();
  const config = getConfig();
  const owner = config.env.GITHUB_OWNER!;
  const repo = config.env.GITHUB_REPO!;
  const branch = config.env.GITHUB_BRANCH;

  // Check if file exists to get its SHA
  let sha: string | undefined;
  try {
    const existing = await ok.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });
    if (!Array.isArray(existing.data) && "sha" in existing.data) {
      sha = existing.data.sha;
    }
  } catch {
    // File doesn't exist yet — that's fine
  }

  const encoded = Buffer.from(content, "utf-8").toString("base64");

  await ok.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: commitMessage,
    content: encoded,
    sha,
    branch,
  });
}

/**
 * Publish multiple JSON files in sequence.
 */
export async function publishAllJsonFiles(
  files: { path: string; content: string }[]
): Promise<void> {
  for (const file of files) {
    await publishJsonFile(
      file.path,
      file.content,
      `Update ${file.path}`
    );
  }
}
