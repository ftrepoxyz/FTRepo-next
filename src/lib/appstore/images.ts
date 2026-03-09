const APPLE_SCREENSHOT_TARGET_SIZE = "1320x2868bb";

export function enhanceAppleScreenshotUrl(url: string): string {
  if (url.includes("{w}x{h}{c}.{f}")) {
    return url.replace("{w}x{h}{c}.{f}", `${APPLE_SCREENSHOT_TARGET_SIZE}.jpg`);
  }

  if (
    !url.includes("mzstatic.com") ||
    !url.includes("/image/thumb/") ||
    !/\/\d+x\d+bb\.(png|jpe?g|webp)(\?.*)?$/i.test(url)
  ) {
    return url;
  }

  return url.replace(
    /\/\d+x\d+bb(?=\.(png|jpe?g|webp)(\?.*)?$)/i,
    `/${APPLE_SCREENSHOT_TARGET_SIZE}`
  );
}

export function enhanceAppleScreenshotUrls(screenshotUrls: unknown): string[] {
  if (!Array.isArray(screenshotUrls)) return [];

  return screenshotUrls
    .filter((url): url is string => typeof url === "string" && url.length > 0)
    .map(enhanceAppleScreenshotUrl);
}
