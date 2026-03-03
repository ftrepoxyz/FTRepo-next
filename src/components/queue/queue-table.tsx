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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePolling } from "@/hooks/use-polling";
import { formatDistanceToNow } from "date-fns";
import {
  RotateCw,
  Trash2,
  SkipForward,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ElementType; label: string; className: string }> = {
    pending: {
      icon: Clock,
      label: "Pending",
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    downloading: {
      icon: Loader2,
      label: "Downloading",
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    processing: {
      icon: Loader2,
      label: "Processing",
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    completed: {
      icon: CheckCircle2,
      label: "Completed",
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    failed: {
      icon: XCircle,
      label: "Failed",
      className: "bg-red-500/10 text-red-600 dark:text-red-400",
    },
  };

  const c = config[status] ?? {
    icon: Clock,
    label: status,
    className: "bg-muted text-muted-foreground",
  };
  const Icon = c.icon;
  const isSpinning = status === "downloading" || status === "processing";

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", c.className)}>
      <Icon className={cn("h-3 w-3", isSpinning && "animate-spin")} />
      {c.label}
    </span>
  );
}

function StatDot({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      <span>{label}</span>
      <span className="font-semibold text-foreground">{count}</span>
    </div>
  );
}

type SortField = "fileName" | "channelId" | "fileSize" | "status" | "createdAt";

function SortHeader({ label, field, sortBy, sortOrder, onSort }: {
  label: string;
  field: SortField;
  sortBy: SortField;
  sortOrder: "asc" | "desc";
  onSort: (field: SortField) => void;
}) {
  const isActive = sortBy === field;
  const Icon = !isActive ? ArrowUpDown : sortOrder === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      className={cn(
        "flex items-center gap-1 transition-colors hover:text-foreground",
        isActive ? "text-foreground" : "text-muted-foreground"
      )}
      onClick={() => onSort(field)}
    >
      {label}
      <Icon className={cn("h-3 w-3", isActive && "text-foreground")} />
    </button>
  );
}

function Checkbox({ checked, onChange, className }: {
  checked?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/40 bg-transparent hover:border-muted-foreground",
        className,
      )}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5L4.5 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
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

  const allChecked = items.length > 0 && items.every((i) => selectedIds.has(i.id));

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

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <StatDot color="bg-amber-500" label="Pending" count={stats.pending ?? 0} />
        <StatDot color="bg-blue-500" label="Active" count={(stats.downloading ?? 0) + (stats.processing ?? 0)} />
        <StatDot color="bg-emerald-500" label="Done" count={stats.completed ?? 0} />
        <StatDot color="bg-red-500" label="Failed" count={stats.failed ?? 0} />

        {selectedIds.size > 0 && (
          <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
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

      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10">
                <Checkbox checked={allChecked} onChange={(checked) => {
                  setSelectedIds(checked ? new Set(items.map((i) => i.id)) : new Set());
                }} />
              </TableHead>
              <TableHead><SortHeader label="File" field="fileName" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead><SortHeader label="Channel" field="channelId" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead><SortHeader label="Size" field="fileSize" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead><SortHeader label="Status" field="status" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead>Error</TableHead>
              <TableHead><SortHeader label="Time" field="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Queue is empty
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow
                  key={item.id}
                  data-state={selectedIds.has(item.id) ? "selected" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                    />
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-mono text-xs">
                    {item.fileName || `msg:${item.messageId}`}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.channelId}</TableCell>
                  <TableCell className="text-xs tabular-nums text-muted-foreground">
                    {item.fileSize ? formatBytes(item.fileSize) : "\u2014"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                    {item.error && (
                      <span className="inline-flex items-center gap-1 text-red-600/80 dark:text-red-400/80">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        {item.error}
                      </span>
                    )}
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
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleRetry(item.id)}
                        title="Retry"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
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
