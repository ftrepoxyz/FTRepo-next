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
import { Input } from "@/components/ui/input";
import { usePolling } from "@/hooks/use-polling";
import { formatDistanceToNow } from "date-fns";
import { RotateCw, Trash2, SkipForward, Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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

type SortField = "fileName" | "channelId" | "fileSize" | "status" | "createdAt";

function SortHeader({ label, field, sortBy, sortOrder, onSort }: {
  label: string;
  field: SortField;
  sortBy: SortField;
  sortOrder: "asc" | "desc";
  onSort: (field: SortField) => void;
}) {
  const Icon = sortBy !== field ? ArrowUpDown : sortOrder === "asc" ? ArrowUp : ArrowDown;
  return (
    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => onSort(field)}>
      {label}
      <Icon className="h-3 w-3" />
    </button>
  );
}

export function QueueTable() {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleSort = (field: SortField) => {
    if (field === sortBy) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      sortBy,
      sortOrder,
      ...(search && { search }),
    });
    const res = await fetch(`/api/queue?${params}`);
    return res.json();
  }, [page, search, sortBy, sortOrder]);

  const { data, refresh } = usePolling(fetcher, 10000);
  const items: QueueEntry[] = data?.data || [];
  const stats = data?.stats || {};
  const totalPages: number = data?.totalPages || 1;

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
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by filename..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
      </div>

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
              <TableHead><SortHeader label="File" field="fileName" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead><SortHeader label="Channel" field="channelId" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead><SortHeader label="Size" field="fileSize" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead><SortHeader label="Status" field="status" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead>Error</TableHead>
              <TableHead><SortHeader label="Time" field="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
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

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
