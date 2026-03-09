import { enhanceAppleScreenshotUrl } from "./images";

const APP_STORE_PAGE_URL_PATTERN =
  /https:\/\/is\d+-ssl\.mzstatic\.com\/image\/thumb\/[^"'()\s]+/gi;

const SCREENSHOT_BASE_PATTERN =
  /\/\d+x\d+bb(?:-60)?\.(?:png|jpe?g|webp)(\?.*)?$/i;

function isScreenshotCandidate(url: string): boolean {
  const normalized = url.toLowerCase();

  return (
    !normalized.includes("{w}") &&
    normalized.includes("screen") &&
    normalized.includes("mzstatic.com/image/thumb/") &&
    !normalized.includes("appicon") &&
    !normalized.includes("placeholder") &&
    !normalized.includes("avatar") &&
    !normalized.includes("/features") &&
    !normalized.includes("watch")
  );
}

function screenshotBaseKey(url: string): string {
  return url.replace(SCREENSHOT_BASE_PATTERN, "");
}

function extractScreenshotUrls(html: string): string[] {
  const matches = html.match(APP_STORE_PAGE_URL_PATTERN) || [];
  const seen = new Set<string>();
  const screenshots: string[] = [];

  for (const rawUrl of matches) {
    const url = rawUrl.replace(/&amp;/g, "&");
    if (!isScreenshotCandidate(url)) continue;

    const key = screenshotBaseKey(url);
    if (seen.has(key)) continue;

    seen.add(key);
    screenshots.push(enhanceAppleScreenshotUrl(url));
  }

  return screenshots;
}

export async function lookupAppPageScreenshots(
  pageUrl: string
): Promise<string[]> {
  try {
    const response = await fetch(pageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 FTRepo/1.0" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];

    const html = await response.text();
    return extractScreenshotUrls(html);
  } catch {
    return [];
  }
}
