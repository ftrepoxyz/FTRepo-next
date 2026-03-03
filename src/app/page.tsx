import { prisma } from "@/lib/db";
import { getFileConfig } from "@/lib/config";
import { StartPage } from "@/components/start-page";

export default async function Home() {
  let sourceName = "FTRepo";
  let sourceSubtitle = "iOS App Repository";
  let tintColor = "#5C7AEA";
  let baseUrl: string | null = null;
  let siteDomain = "";

  try {
    const fileConfig = getFileConfig();
    sourceName = fileConfig.source.name || sourceName;
    sourceSubtitle =
      fileConfig.source.subtitle ||
      fileConfig.source.description ||
      sourceSubtitle;
    tintColor = fileConfig.source.tintColor || tintColor;
  } catch {
    // File config not available, use defaults
  }

  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            "github_owner",
            "github_repo",
            "github_branch",
            "source_name",
            "source_description",
            "site_domain",
          ],
        },
      },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    if (map.source_name) sourceName = map.source_name;
    if (map.source_description) sourceSubtitle = map.source_description;
    if (map.site_domain) siteDomain = map.site_domain;

    const owner =
      map.github_owner || process.env.GITHUB_OWNER || "";
    const repo =
      map.github_repo || process.env.GITHUB_REPO || "";
    if (owner && repo) {
      const branch =
        map.github_branch || process.env.GITHUB_BRANCH || "main";
      baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`;
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
