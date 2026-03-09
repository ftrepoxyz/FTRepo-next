import { StartPage } from "@/components/start-page";
import { getSettingsOrDefaults } from "@/lib/config";

export const revalidate = 60;

export default async function Home() {
  const settings = await getSettingsOrDefaults();
  const sourceName = settings.source_name;
  const sourceSubtitle = settings.source_subtitle;
  const tintColor = settings.source_tint_color;
  let baseUrl: string | null = null;
  const siteDomain = settings.site_domain;

  const owner = settings.github_owner || process.env.GITHUB_OWNER || "";
  const repo = settings.github_repo || process.env.GITHUB_REPO || "";
  if (owner && repo) {
    if (siteDomain) {
      // Use short redirect URLs (e.g., domain.com/feather) instead of raw GitHub links
      const domain = siteDomain.replace(/\/+$/, "");
      baseUrl =
        (domain.startsWith("http") ? domain : `https://${domain}`) + "/";
    } else {
      const branch = settings.github_branch || process.env.GITHUB_BRANCH || "main";
      baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`;
    }
  }

  return (
    <StartPage
      sourceName={sourceName}
      sourceSubtitle={sourceSubtitle}
      baseUrl={baseUrl}
      tintColor={tintColor}
      siteDomain={siteDomain}
    />
  );
}
