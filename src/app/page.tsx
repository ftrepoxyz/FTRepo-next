import { prisma } from "@/lib/db";
import { StartPage } from "@/components/start-page";

export const dynamic = "force-dynamic";

export default async function Home() {
  let sourceName = "FTRepo";
  let sourceSubtitle = "iOS App Repository";
  let tintColor = "#5C7AEA";
  let baseUrl: string | null = null;
  let siteDomain = "";

  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            "github_owner",
            "github_repo",
            "github_branch",
            "source_name",
            "source_subtitle",
            "source_tint_color",
            "site_domain",
          ],
        },
      },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    if (map.source_name) sourceName = map.source_name;
    if (map.source_subtitle) sourceSubtitle = map.source_subtitle;
    if (map.source_tint_color) tintColor = map.source_tint_color;
    if (map.site_domain) siteDomain = map.site_domain;

    const owner =
      map.github_owner || process.env.GITHUB_OWNER || "";
    const repo =
      map.github_repo || process.env.GITHUB_REPO || "";
    if (owner && repo) {
      if (siteDomain) {
        // Use short redirect URLs (e.g., domain.com/feather) instead of raw GitHub links
        const domain = siteDomain.replace(/\/+$/, "");
        baseUrl = (domain.startsWith("http") ? domain : `https://${domain}`) + "/";
      } else {
        const branch =
          map.github_branch || process.env.GITHUB_BRANCH || "main";
        baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`;
      }
    }
  } catch {
    // DB not available, use defaults
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
