export interface IpaMetadata {
  bundleId: string;
  appName: string;
  version: string;
  buildNumber?: string;
  minOsVersion?: string;
  tweaks: string[];
  isTweaked: boolean;
  entitlements: Record<string, string>;
  privacyInfo: Record<string, string>;
}

export interface AppStoreLookup {
  bundleId: string;
  appName: string;
  iconUrl: string;
  screenshots: string[];
  description: string;
  developer: string;
  genre: string;
  price: number;
  rating: number;
}

export interface GithubRelease {
  id: number;
  tagName: string;
  name: string;
  downloadUrl: string;
  assetId: number;
  size: number;
  createdAt: string;
}

export interface ChannelInfo {
  id: string;
  name: string;
  isActive: boolean;
  lastScannedAt?: Date;
  totalMessages: number;
  ipaCount: number;
}

export interface QueueItem {
  id: number;
  channelId: string;
  messageId: number;
  fileName?: string;
  fileSize?: number;
  status: string;
  error?: string;
  createdAt: Date;
}

export interface DashboardStatus {
  totalIpas: number;
  totalDownloads: number;
  storageUsed: number;
  activeChannels: number;
  queueDepth: number;
  workerStatus: "running" | "stopped" | "error";
  lastScanAt?: string;
  lastJsonGenAt?: string;
  uptime: number;
}
