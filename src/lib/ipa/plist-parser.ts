import plist from "plist";

export interface ParsedPlist {
  bundleId: string;
  appName: string;
  version: string;
  buildNumber: string;
  minOsVersion?: string;
  privacyDescriptions: Record<string, string>;
  executable?: string;
}

export function parsePlist(data: Buffer): ParsedPlist {
  const parsed = plist.parse(data.toString("utf-8")) as Record<string, unknown>;

  const privacyDescriptions: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (key.startsWith("NS") && key.endsWith("UsageDescription") && typeof value === "string") {
      privacyDescriptions[key] = value;
    }
  }

  return {
    bundleId: (parsed.CFBundleIdentifier as string) || "",
    appName:
      (parsed.CFBundleDisplayName as string) ||
      (parsed.CFBundleName as string) ||
      "",
    version: (parsed.CFBundleShortVersionString as string) || "1.0",
    buildNumber: (parsed.CFBundleVersion as string) || "1",
    minOsVersion: parsed.MinimumOSVersion as string | undefined,
    privacyDescriptions,
    executable: parsed.CFBundleExecutable as string | undefined,
  };
}
