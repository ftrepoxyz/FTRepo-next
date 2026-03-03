import { Octokit } from "@octokit/rest";
import { readFileSync, statSync } from "fs";
import { getSettings } from "../config";

let octokit: Octokit | null = null;

async function getOctokit(): Promise<Octokit> {
  if (!octokit) {
    const settings = await getSettings();
    const token = settings.github_token;
    if (!token) throw new Error("GITHUB_TOKEN not configured");
    octokit = new Octokit({ auth: token });
  }
  return octokit;
}

async function getRepoInfo() {
  const settings = await getSettings();
  const owner = settings.github_owner;
  const repo = settings.github_repo;
  if (!owner || !repo) throw new Error("GITHUB_OWNER and GITHUB_REPO must be configured");
  return { owner, repo };
}

export function invalidateGitHubClient(): void {
  octokit = null;
}

/**
 * Get a release by its tag name, or null if not found.
 */
async function getReleaseByTag(tagName: string) {
  const ok = await getOctokit();
  const { owner, repo } = await getRepoInfo();
  try {
    const { data } = await ok.repos.getReleaseByTag({ owner, repo, tag: tagName });
    return data;
  } catch (e: unknown) {
    if (e && typeof e === "object" && "status" in e && e.status === 404) return null;
    throw e;
  }
}

/**
 * Upload an IPA to a daily grouped release (one release per date).
 * If a release for today already exists, the IPA is added as a new asset.
 * If not, a new release is created for today's date.
 */
export async function uploadIpaToDailyRelease(
  appName: string,
  version: string,
  bundleId: string,
  isTweaked: boolean,
  tweaks: string[],
  ipaPath: string
): Promise<{ releaseId: number; assetId: number; downloadUrl: string }> {
  const ok = await getOctokit();
  const { owner, repo } = await getRepoInfo();

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const tagName = today;

  // Build the entry for this IPA in the release body
  const entry = [
    `### ${appName} v${version}`,
    `Bundle ID: ${bundleId}`,
    isTweaked ? `Tweaks: ${tweaks.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Try to find existing daily release
  let release = await getReleaseByTag(tagName);

  if (release) {
    // Append to existing release body
    const updatedBody = release.body ? `${release.body}\n\n${entry}` : entry;
    await ok.repos.updateRelease({
      owner,
      repo,
      release_id: release.id,
      body: updatedBody,
    });
  } else {
    // Create new daily release
    const dateFormatted = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const { data } = await ok.repos.createRelease({
      owner,
      repo,
      tag_name: tagName,
      name: dateFormatted,
      body: entry,
      draft: false,
      prerelease: false,
    });
    release = data;
  }

  // Asset filename: include tweak name to avoid collisions between tweaks with same bundleId+version
  const tweakSlug = isTweaked && tweaks.length > 0 ? `_${tweaks[0]}` : "";
  const assetFileName = `${bundleId}${tweakSlug}_${version}.ipa`;

  // Check for existing asset with same name and delete it (re-upload case)
  for (const existing of release.assets || []) {
    if (existing.name === assetFileName) {
      await ok.repos.deleteReleaseAsset({ owner, repo, asset_id: existing.id });
      break;
    }
  }

  // Upload IPA asset
  const fileSize = statSync(ipaPath).size;
  const fileData = readFileSync(ipaPath);

  const asset = await ok.repos.uploadReleaseAsset({
    owner,
    repo,
    release_id: release.id,
    name: assetFileName,
    // @ts-expect-error - Octokit types don't match Buffer well
    data: fileData,
    headers: {
      "content-type": "application/octet-stream",
      "content-length": fileSize,
    },
  });

  return {
    releaseId: release.id,
    assetId: asset.data.id,
    downloadUrl: asset.data.browser_download_url,
  };
}

/**
 * List all releases in the repository.
 */
export async function listReleases(): Promise<
  { id: number; tagName: string; name: string; createdAt: string; assets: { id: number; name: string; downloadUrl: string; size: number }[] }[]
> {
  const ok = await getOctokit();
  const { owner, repo } = await getRepoInfo();

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
      id: a.id,
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
  const ok = await getOctokit();
  const { owner, repo } = await getRepoInfo();
  await ok.repos.deleteRelease({ owner, repo, release_id: releaseId });
}

/**
 * Delete a single release asset by ID.
 */
export async function deleteReleaseAsset(assetId: number): Promise<void> {
  const ok = await getOctokit();
  const { owner, repo } = await getRepoInfo();
  await ok.repos.deleteReleaseAsset({ owner, repo, asset_id: assetId });
}

/**
 * Get a release by ID and return its remaining assets.
 */
export async function getRelease(releaseId: number): Promise<{ id: number; assets: { id: number; name: string }[] } | null> {
  const ok = await getOctokit();
  const { owner, repo } = await getRepoInfo();
  try {
    const { data } = await ok.repos.getRelease({ owner, repo, release_id: releaseId });
    return { id: data.id, assets: data.assets.map((a) => ({ id: a.id, name: a.name })) };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "status" in e && e.status === 404) return null;
    throw e;
  }
}
