import { readFileSync } from "fs";
import { resolve } from "path";
import { parse as parseYaml } from "yaml";
import { z } from "zod/v4";

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

const EnvSchema = z.object({
  DATABASE_URL: z.string(),
  TELEGRAM_API_ID: z.string().optional(),
  TELEGRAM_API_HASH: z.string().optional(),
  TELEGRAM_PHONE: z.string().optional(),
  TELEGRAM_CHANNELS: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_OWNER: z.string().optional(),
  GITHUB_REPO: z.string().optional(),
  GITHUB_BRANCH: z.string().default("main"),
  APPSTORE_COUNTRY: z.string().default("us"),
  SCAN_INTERVAL_MINUTES: z.coerce.number().default(30),
  JSON_REGEN_INTERVAL_MINUTES: z.coerce.number().default(60),
  CLEANUP_INTERVAL_HOURS: z.coerce.number().default(24),
  MAX_VERSIONS_PER_APP: z.coerce.number().default(5),
  TEMP_DIR: z.string().default("/tmp/ftrepo"),
  LOG_RETENTION_DAYS: z.coerce.number().default(30),
});

export type AppConfig = z.infer<typeof ConfigFileSchema> & {
  env: z.infer<typeof EnvSchema>;
};

let cachedConfig: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  let fileConfig: z.infer<typeof ConfigFileSchema>;
  try {
    const configPath = resolve(process.cwd(), ".github/config.yml");
    const raw = readFileSync(configPath, "utf-8");
    fileConfig = ConfigFileSchema.parse(parseYaml(raw));
  } catch {
    fileConfig = ConfigFileSchema.parse({});
  }

  const env = EnvSchema.parse(process.env);

  cachedConfig = { ...fileConfig, env };
  return cachedConfig;
}

export function getConfig(): AppConfig {
  return loadConfig();
}

export function getTelegramChannels(): string[] {
  const channels = getConfig().env.TELEGRAM_CHANNELS;
  if (!channels) return [];
  return channels.split(",").map((c) => c.trim()).filter(Boolean);
}
