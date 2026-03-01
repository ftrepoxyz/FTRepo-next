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
  subtitle: string;
  localizedDescription: string;
  iconURL: string;
  tintColor: string;
  screenshotURLs: string[];
  versions: AltStoreVersion[];
  appPermissions: AltStorePermissions;
  category?: string;
}

export interface AltStoreVersion {
  version: string;
  date: string;
  size: number;
  downloadURL: string;
  localizedDescription: string;
  minOSVersion?: string;
}

export interface AltStorePermissions {
  entitlements: AltStoreEntitlement[];
  privacy: AltStorePrivacy[];
}

export interface AltStoreEntitlement {
  name: string;
}

export interface AltStorePrivacy {
  name: string;
  usageDescription: string;
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
