export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ActivityEntry {
  id: number;
  type: string;
  message: string;
  status: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface MetricsOverview {
  totalIpas: number;
  totalDownloads: number;
  storageUsedBytes: number;
  activeChannels: number;
  successRate: number;
  downloadsByDay: { date: string; count: number }[];
  ipasByChannel: { channel: string; count: number }[];
  storageByApp: { app: string; sizeBytes: number }[];
}

export interface SettingsPayload {
  [key: string]: string | number | boolean;
}
