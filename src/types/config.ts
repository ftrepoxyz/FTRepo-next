export interface SourceConfig {
  name: string;
  subtitle: string;
  description: string;
  iconURL: string;
  headerURL: string;
  website: string;
  tintColor: string;
  featuredApps: string[];
}

export interface CategoryConfig {
  name: string;
  id: string;
}

export interface NewsEntry {
  title: string;
  identifier: string;
  caption: string;
  date: string;
  tintColor?: string;
  imageURL?: string;
  url?: string;
  appID?: string;
  notify?: boolean;
}

export interface AltStoreApp {
  name: string;
  bundleIdentifier: string;
  developerName: string;
  localizedDescription: string;
  iconURL: string;
  versions: AltStoreVersion[];
  appPermissions: Record<string, never>;
  version: string;
  versionDate: string;
  size: number;
  downloadURL: string;
}

export interface AltStoreVersion {
  version: string;
  date: string;
  size: number;
  downloadURL: string;
}

export interface ESignApp {
  name: string;
  version: string;
  versionDate: string;
  size: number;
  down: string;
  developerName: string;
  bundleIdentifier: string;
  iconURL: string;
  localizedDescription: string;
  screenshotURLs: string[];
  tintColor: string;
}

export interface ScarletApp {
  name: string;
  version: string;
  down: string;
  category: string;
  bundleID: string;
  icon: string;
  description: string;
  developer: string;
  screenshots: string[];
  accentColor: {
    light: { red: number; green: number; blue: number };
  };
}

export interface FeatherApp extends AltStoreApp {}

export interface FileConfig {
  source: SourceConfig;
  categories: CategoryConfig[];
  news: NewsEntry[];
}

export interface AppSettings {
  telegram_api_id: string;
  telegram_api_hash: string;
  telegram_phone: string;
  github_token: string;
  github_owner: string;
  github_repo: string;
  github_branch: string;
  appstore_country: string;
  scan_interval_minutes: number;
  json_regen_interval_minutes: number;
  cleanup_interval_hours: number;
  max_versions_per_app: number;
  temp_dir: string;
  log_retention_days: number;
  scan_message_limit: number;
  known_tweaks: string[];
  source_name: string;
  source_description: string;
  site_domain: string;
}
