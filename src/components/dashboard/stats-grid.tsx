"use client";

import { useCallback } from "react";
import { StatusCard } from "./status-card";
import { usePolling } from "@/hooks/use-polling";
import {
  Package,
  Download,
  HardDrive,
  Radio,
  ListOrdered,
  Clock,
} from "lucide-react";
import type { DashboardStatus } from "@/types/models";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function StatsGrid() {
  const fetcher = useCallback(async () => {
    const res = await fetch("/api/dashboard/status");
    const json = await res.json();
    return json.data as DashboardStatus;
  }, []);

  const { data: status } = usePolling(fetcher, 10000);

  if (!status) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[110px] animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatusCard
        title="Total IPAs"
        value={status.totalIpas}
        icon={Package}
      />
      <StatusCard
        title="Downloads"
        value={status.totalDownloads}
        icon={Download}
      />
      <StatusCard
        title="Storage"
        value={formatBytes(status.storageUsed)}
        icon={HardDrive}
      />
      <StatusCard
        title="Channels"
        value={status.activeChannels}
        icon={Radio}
      />
      <StatusCard
        title="Queue"
        value={status.queueDepth}
        description="Pending items"
        icon={ListOrdered}
      />
      <StatusCard
        title="Uptime"
        value={formatUptime(status.uptime)}
        icon={Clock}
      />
    </div>
  );
}
