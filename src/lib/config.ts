import { readFileSync } from "fs";
import { resolve } from "path";
import { parse as parseYaml } from "yaml";
import { z } from "zod/v4";
import { prisma } from "./db";
import type { FileConfig, AppSettings } from "@/types/config";

// --- File-based config (source, categories, news) — stays sync ---

const SourceSchema = z.object({
  name: z.string().default("FTRepo"),
  subtitle: z.string().default("iOS App Repository"),
  description: z.string().default("Automated iOS IPA distribution"),
  iconURL: z.string().default(""),
  headerURL: z.string().default(""),
  website: z.string().default(""),
  tintColor: z.string().default("#5C7AEA"),
  featuredApps: z.array(z.string()).default([]),
});

const CategorySchema = z.object({
  name: z.string(),
  id: z.string(),
});

const NewsSchema = z.object({
  title: z.string(),
  identifier: z.string(),
  caption: z.string(),
  date: z.string(),
  tintColor: z.string().optional(),
  imageURL: z.string().optional(),
  url: z.string().optional(),
  appID: z.string().optional(),
  notify: z.boolean().optional(),
});

const DEFAULT_SOURCE = {
  name: "FTRepo",
  subtitle: "iOS App Repository",
  description: "Automated iOS IPA distribution",
  iconURL: "",
  headerURL: "",
  website: "",
  tintColor: "#5C7AEA",
  featuredApps: [] as string[],
};

const ConfigFileSchema = z.object({
  source: SourceSchema.optional(),
  categories: z.array(CategorySchema).default([
    { name: "Tweaked", id: "tweaked" },
    { name: "Other", id: "other" },
  ]),
  news: z.array(NewsSchema).default([]),
}).transform((data) => ({
  ...data,
  source: data.source ?? DEFAULT_SOURCE,
}));

let cachedFileConfig: FileConfig | null = null;

export function getFileConfig(): FileConfig {
  if (cachedFileConfig) return cachedFileConfig;

  try {
    const configPath = resolve(process.cwd(), ".github/config.yml");
    const raw = readFileSync(configPath, "utf-8");
    cachedFileConfig = ConfigFileSchema.parse(parseYaml(raw)) as FileConfig;
  } catch {
    cachedFileConfig = ConfigFileSchema.parse({}) as FileConfig;
  }

  return cachedFileConfig;
}

// --- DB-backed settings with TTL cache ---

export const DEFAULT_KNOWN_TWEAKS = [
  "BHInsta", "BHTikTok", "BHX", "TikTokLRD", "VibeTok", "Theta",
  "TWIGalaxy", "NeoFreeBird", "Rocket", "Watusi", "OLED", "RXTikTok",
  "IGFormat", "DLEasy", "TGExtra", "Spotilife", "YouTopia", "EveeSpotify",
  "Glow", "InstaLRD", "LRD", "Preview", "Flow", "YTPlus", "GLETikTok",
  "Moe Multi",
];

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
  known_tweaks: JSON.stringify(DEFAULT_KNOWN_TWEAKS),
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
    known_tweaks: dbMap.get("known_tweaks") ?? SETTINGS_DEFAULTS.known_tweaks,
  };

  function num(key: string): number {
    return Number(raw[key]) || Number(SETTINGS_DEFAULTS[key]);
  }

  function jsonArray(key: string, fallback: string[]): string[] {
    try {
      const parsed = JSON.parse(raw[key]);
      return Array.isArray(parsed) ? parsed : fallback;
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
    known_tweaks: jsonArray("known_tweaks", DEFAULT_KNOWN_TWEAKS),
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
  });
  return channels.map((c) => c.channelId);
}
