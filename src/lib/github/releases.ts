import { Octokit } from "@octokit/rest";
import { readFileSync, statSync } from "fs";
import { basename } from "path";
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

function getRepoInfo() {
  const config = getConfig();
  const owner = config.env.GITHUB_OWNER;
  const repo = config.env.GITHUB_REPO;
  if (!owner || !repo) throw new Error("GITHUB_OWNER and GITHUB_REPO must be configured");
  return { owner, repo };
}

/**
 * Create a GitHub release and upload an IPA as an asset.
 */
export async function createReleaseWithIpa(
  tagName: string,
  releaseName: string,
  body: string,
  ipaPath: string
): Promise<{ releaseId: number; downloadUrl: string }> {
  const ok = getOctokit();
  const { owner, repo } = getRepoInfo();

  // Create release
  const release = await ok.repos.createRelease({
    owner,
    repo,
    tag_name: tagName,
    name: releaseName,
    body,
    draft: false,
    prerelease: false,
  });

  // Upload IPA asset
  const fileName = basename(ipaPath);
  const fileSize = statSync(ipaPath).size;
  const fileData = readFileSync(ipaPath);

  const asset = await ok.repos.uploadReleaseAsset({
    owner,
    repo,
    release_id: release.data.id,
    name: fileName,
    // @ts-expect-error - Octokit types don't match Buffer well
    data: fileData,
    headers: {
      "content-type": "application/octet-stream",
      "content-length": fileSize,
    },
  });

  return {
    releaseId: release.data.id,
    downloadUrl: asset.data.browser_download_url,
  };
}

/**
 * List all releases in the repository.
 */
export async function listReleases(): Promise<
  { id: number; tagName: string; name: string; createdAt: string; assets: { name: string; downloadUrl: string; size: number }[] }[]
> {
  const ok = getOctokit();
  const { owner, repo } = getRepoInfo();

  const releases = await ok.paginate(ok.repos.listReleases, {
    owner,
    repo,
    per_page: 100,
  });

  return releases.map((r) => ({
    id: r.id,
    tagName: r.tag_name,
    name: r.name || r.tag_name,
    createdAt: r.created_at,
    assets: r.assets.map((a) => ({
      name: a.name,
      downloadUrl: a.browser_download_url,
      size: a.size,
    })),
  }));
}

/**
 * Delete a release by ID.
 */
export async function deleteRelease(releaseId: number): Promise<void> {
  const ok = getOctokit();
  const { owner, repo } = getRepoInfo();
  await ok.repos.deleteRelease({ owner, repo, release_id: releaseId });
}
