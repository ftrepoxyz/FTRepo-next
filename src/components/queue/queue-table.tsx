"use client";

import { useState, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePolling } from "@/hooks/use-polling";
import { formatDistanceToNow } from "date-fns";
import { RotateCw, Trash2, SkipForward } from "lucide-react";
import { toast } from "sonner";

interface QueueEntry {
  id: number;
  channelId: string;
  messageId: number;
  fileName: string | null;
  fileSize: number | null;
  status: string;
  error: string | null;
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const statusVariant = (status: string): "default" | "destructive" | "secondary" | "outline" => {
  switch (status) {
    case "completed":
      return "default";
    case "failed":
      return "destructive";
    case "downloading":
    case "processing":
      return "secondary";
    default:
      return "outline";
  }
};

export function QueueTable() {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/queue?pageSize=50");
    return res.json();
  }, []);

  const { data, refresh } = usePolling(fetcher, 10000);
  const items: QueueEntry[] = data?.data || [];
  const stats = data?.stats || {};

  const handleRetry = async (id: number) => {
    await fetch("/api/queue/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    toast.success("Item queued for retry");
    refresh();
  };

  const handleBatch = async (action: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    await fetch("/api/queue/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids }),
    });
    toast.success(`${action} applied to ${ids.length} items`);
    setSelectedIds(new Set());
    refresh();
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex gap-2 text-sm">
          <Badge variant="outline">Pending: {stats.pending ?? 0}</Badge>
          <Badge variant="secondary">Active: {(stats.downloading ?? 0) + (stats.processing ?? 0)}</Badge>
          <Badge variant="default">Done: {stats.completed ?? 0}</Badge>
          <Badge variant="destructive">Failed: {stats.failed ?? 0}</Badge>
        </div>
        {selectedIds.size > 0 && (
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBatch("retry")}
            >
              <RotateCw className="mr-1 h-3 w-3" /> Retry ({selectedIds.size})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBatch("skip")}
            >
              <SkipForward className="mr-1 h-3 w-3" /> Skip
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleBatch("delete")}
            >
              <Trash2 className="mr-1 h-3 w-3" /> Delete
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(new Set(items.map((i) => i.id)));
                    } else {
                      setSelectedIds(new Set());
                    }
                  }}
                />
              </TableHead>
              <TableHead>File</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Time</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Queue is empty
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                    />
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-mono text-xs">
                    {item.fileName || `msg:${item.messageId}`}
                  </TableCell>
                  <TableCell className="text-xs">{item.channelId}</TableCell>
                  <TableCell className="text-xs">
                    {item.fileSize ? formatBytes(item.fileSize) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(item.status)}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-destructive">
                    {item.error}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    {item.status === "failed" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleRetry(item.id)}
                      >
                        <RotateCw className="h-3 w-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
