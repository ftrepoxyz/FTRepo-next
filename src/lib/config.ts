import { prisma } from "./db";
import type { AppSettings, TweakConfig } from "@/types/config";

// --- DB-backed settings with TTL cache ---

export const DEFAULT_KNOWN_TWEAKS: TweakConfig[] = [];

const SETTINGS_DEFAULTS: Record<string, string> = {
  telegram_api_id: "",
  telegram_api_hash: "",
  telegram_phone: "",
  github_token: "",
  github_owner: "",
  github_repo: "",
  github_branch: "main",
  appstore_country: "us",
  scan_interval_minutes: "30",
  json_regen_interval_minutes: "60",
  cleanup_interval_hours: "24",
  max_versions_per_app: "5",
  temp_dir: "/tmp/ftrepo",
  log_retention_days: "30",
  scan_message_limit: "500",
  previous_ipa_scan_amount: "50",
  known_tweaks: JSON.stringify(DEFAULT_KNOWN_TWEAKS),
  source_name: "FTRepo",
  source_description: "Automated iOS IPA distribution",
  source_subtitle: "iOS App Repository",
  source_icon_url: "",
  source_tint_color: "#5C7AEA",
  site_domain: "",
  system_enabled: "true",
};

let cachedSettings: AppSettings | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

export async function getSettings(): Promise<AppSettings> {
  const now = Date.now();
  if (cachedSettings && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSettings;
  }

  const rows = await prisma.setting.findMany();
  const dbMap = new Map(rows.map((r) => [r.key, r.value]));

  // Build settings with fallback chain: DB → process.env → hardcoded default
  const raw: Record<string, string> = {
    telegram_api_id: dbMap.get("telegram_api_id") ?? process.env.TELEGRAM_API_ID ?? SETTINGS_DEFAULTS.telegram_api_id,
    telegram_api_hash: dbMap.get("telegram_api_hash") ?? process.env.TELEGRAM_API_HASH ?? SETTINGS_DEFAULTS.telegram_api_hash,
    telegram_phone: dbMap.get("telegram_phone") ?? process.env.TELEGRAM_PHONE ?? SETTINGS_DEFAULTS.telegram_phone,
    github_token: dbMap.get("github_token") ?? process.env.GITHUB_TOKEN ?? SETTINGS_DEFAULTS.github_token,
    github_owner: dbMap.get("github_owner") ?? process.env.GITHUB_OWNER ?? SETTINGS_DEFAULTS.github_owner,
    github_repo: dbMap.get("github_repo") ?? process.env.GITHUB_REPO ?? SETTINGS_DEFAULTS.github_repo,
    github_branch: dbMap.get("github_branch") ?? process.env.GITHUB_BRANCH ?? SETTINGS_DEFAULTS.github_branch,
    appstore_country: dbMap.get("appstore_country") ?? process.env.APPSTORE_COUNTRY ?? SETTINGS_DEFAULTS.appstore_country,
    scan_interval_minutes: dbMap.get("scan_interval_minutes") ?? process.env.SCAN_INTERVAL_MINUTES ?? SETTINGS_DEFAULTS.scan_interval_minutes,
    json_regen_interval_minutes: dbMap.get("json_regen_interval_minutes") ?? process.env.JSON_REGEN_INTERVAL_MINUTES ?? SETTINGS_DEFAULTS.json_regen_interval_minutes,
    cleanup_interval_hours: dbMap.get("cleanup_interval_hours") ?? process.env.CLEANUP_INTERVAL_HOURS ?? SETTINGS_DEFAULTS.cleanup_interval_hours,
    max_versions_per_app: dbMap.get("max_versions_per_app") ?? process.env.MAX_VERSIONS_PER_APP ?? SETTINGS_DEFAULTS.max_versions_per_app,
    temp_dir: dbMap.get("temp_dir") ?? process.env.TEMP_DIR ?? SETTINGS_DEFAULTS.temp_dir,
    log_retention_days: dbMap.get("log_retention_days") ?? process.env.LOG_RETENTION_DAYS ?? SETTINGS_DEFAULTS.log_retention_days,
    scan_message_limit: dbMap.get("scan_message_limit") ?? process.env.SCAN_MESSAGE_LIMIT ?? SETTINGS_DEFAULTS.scan_message_limit,
    previous_ipa_scan_amount: dbMap.get("previous_ipa_scan_amount") ?? SETTINGS_DEFAULTS.previous_ipa_scan_amount,
    known_tweaks: dbMap.get("known_tweaks") ?? SETTINGS_DEFAULTS.known_tweaks,
    source_name: dbMap.get("source_name") ?? SETTINGS_DEFAULTS.source_name,
    source_description: dbMap.get("source_description") ?? SETTINGS_DEFAULTS.source_description,
    source_subtitle: dbMap.get("source_subtitle") ?? SETTINGS_DEFAULTS.source_subtitle,
    source_icon_url: dbMap.get("source_icon_url") ?? SETTINGS_DEFAULTS.source_icon_url,
    source_tint_color: dbMap.get("source_tint_color") ?? SETTINGS_DEFAULTS.source_tint_color,
    site_domain: dbMap.get("site_domain") ?? SETTINGS_DEFAULTS.site_domain,
    system_enabled: dbMap.get("system_enabled") ?? SETTINGS_DEFAULTS.system_enabled,
  };

  function num(key: string): number {
    return Number(raw[key]) || Number(SETTINGS_DEFAULTS[key]);
  }

  function jsonTweaks(key: string, fallback: TweakConfig[]): TweakConfig[] {
    try {
      const parsed = JSON.parse(raw[key]);
      if (!Array.isArray(parsed)) return fallback;
      // Backwards compat: convert string[] to TweakConfig[]
      return parsed.map((entry: string | TweakConfig) =>
        typeof entry === "string"
          ? { name: entry, lockedChannelId: null }
          : entry
      );
    } catch {
      return fallback;
    }
  }

  const settings: AppSettings = {
    telegram_api_id: raw.telegram_api_id,
    telegram_api_hash: raw.telegram_api_hash,
    telegram_phone: raw.telegram_phone,
    github_token: raw.github_token,
    github_owner: raw.github_owner,
    github_repo: raw.github_repo,
    github_branch: raw.github_branch,
    appstore_country: raw.appstore_country,
    temp_dir: raw.temp_dir,
    scan_interval_minutes: num("scan_interval_minutes"),
    json_regen_interval_minutes: num("json_regen_interval_minutes"),
    cleanup_interval_hours: num("cleanup_interval_hours"),
    max_versions_per_app: num("max_versions_per_app"),
    log_retention_days: num("log_retention_days"),
    scan_message_limit: num("scan_message_limit"),
    previous_ipa_scan_amount: num("previous_ipa_scan_amount"),
    known_tweaks: jsonTweaks("known_tweaks", DEFAULT_KNOWN_TWEAKS),
    source_name: raw.source_name,
    source_description: raw.source_description,
    source_subtitle: raw.source_subtitle,
    source_icon_url: raw.source_icon_url,
    source_tint_color: raw.source_tint_color,
    site_domain: raw.site_domain,
    system_enabled: raw.system_enabled === "true",
  };

  cachedSettings = settings;
  cacheTimestamp = now;
  return settings;
}

export function invalidateSettingsCache(): void {
  cachedSettings = null;
  cacheTimestamp = 0;
}

// --- Telegram channels from ChannelProgress table ---

export async function getTelegramChannels(): Promise<string[]> {
  const channels = await prisma.channelProgress.findMany({
    where: { isActive: true },
    select: { channelId: true },
    orderBy: { priority: "asc" },
  });
  return channels.map((c) => c.channelId);
}
