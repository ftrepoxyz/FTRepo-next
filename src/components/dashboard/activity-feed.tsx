"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePolling } from "@/hooks/use-polling";
import { formatDistanceToNow } from "date-fns";
import type { ActivityEntry } from "@/types/api";

export function ActivityFeed() {
  const fetcher = useCallback(async () => {
    const res = await fetch("/api/dashboard/activity?limit=20");
    const json = await res.json();
    return json.data as ActivityEntry[];
  }, []);

  const { data: activities, loading } = usePolling(fetcher, 5000);

  const statusColor = (status: string) => {
    switch (status) {
      case "success":
        return "default";
      case "error":
        return "destructive";
      case "warning":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {loading && !activities ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-3">
              {activities?.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 rounded-md border border-border p-3"
                >
                  <Badge
                    variant={statusColor(activity.status) as "default" | "destructive" | "secondary" | "outline"}
                    className="mt-0.5 shrink-0 text-xs"
                  >
                    {activity.type}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              ))}
              {activities?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No recent activity
                </p>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
