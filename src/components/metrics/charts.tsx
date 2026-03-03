"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePolling } from "@/hooks/use-polling";
import type { MetricsOverview } from "@/types/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

function ChartTooltip({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  formatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-popover/80 px-3 py-2 text-sm shadow-lg backdrop-blur-md">
      {label != null && (
        <p className="mb-1 font-medium text-popover-foreground">{label}</p>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-popover-foreground/80">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span>{formatter ? formatter(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

const COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(47, 96%, 53%)",
  "hsl(0, 84%, 60%)",
  "hsl(262, 83%, 58%)",
  "hsl(199, 89%, 48%)",
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function DownloadChart() {
  const fetcher = useCallback(async () => {
    const res = await fetch("/api/metrics/overview");
    const json = await res.json();
    return json.data as MetricsOverview;
  }, []);

  const { data } = usePolling(fetcher, 60000);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Downloads Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] md:h-[300px]">
          {data?.downloadsByDay && data.downloadsByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.downloadsByDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tickFormatter={(d) => d.slice(5)}
                />
                <YAxis className="text-xs" />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={COLORS[0]}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No download data yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ChannelChart() {
  const fetcher = useCallback(async () => {
    const res = await fetch("/api/metrics/overview");
    const json = await res.json();
    return json.data as MetricsOverview;
  }, []);

  const { data } = usePolling(fetcher, 60000);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">IPAs by Channel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] md:h-[300px]">
          {data?.ipasByChannel && data.ipasByChannel.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ipasByChannel}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="channel" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No channel data yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function StorageChart() {
  const fetcher = useCallback(async () => {
    const res = await fetch("/api/metrics/overview");
    const json = await res.json();
    return json.data as MetricsOverview;
  }, []);

  const { data } = usePolling(fetcher, 60000);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Storage by App</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] md:h-[300px]">
          {data?.storageByApp && data.storageByApp.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.storageByApp.map((s) => ({
                    name: s.app,
                    value: s.sizeBytes,
                  }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) =>
                    `${name}: ${formatBytes(value)}`
                  }
                >
                  {data.storageByApp.map((_, i) => (
                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip formatter={(v) => formatBytes(v)} />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No storage data yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
