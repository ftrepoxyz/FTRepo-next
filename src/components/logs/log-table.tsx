"use client";

import { useState, useCallback } from "react";
import { useUrlState, useUrlNumberState } from "@/hooks/use-url-state";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePolling } from "@/hooks/use-polling";
import { formatDistanceToNow } from "date-fns";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityEntry } from "@/types/api";

const LOG_TYPES = [
  { value: "scan", label: "Scan" },
  { value: "download", label: "Download" },
  { value: "process", label: "Process" },
  { value: "upload", label: "Upload" },
  { value: "cleanup", label: "Cleanup" },
  { value: "generate", label: "Generate" },
  { value: "error", label: "Error" },
  { value: "system", label: "System" },
];

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ElementType; label: string; className: string }> = {
    info: {
      icon: Info,
      label: "Info",
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    success: {
      icon: CheckCircle2,
      label: "Success",
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    warning: {
      icon: AlertTriangle,
      label: "Warning",
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    error: {
      icon: XCircle,
      label: "Error",
      className: "bg-red-500/10 text-red-600 dark:text-red-400",
    },
  };

  const c = config[status] ?? {
    icon: Info,
    label: status,
    className: "bg-muted text-muted-foreground",
  };
  const Icon = c.icon;

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", c.className)}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {type}
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

type SortField = "type" | "status" | "message" | "createdAt";

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

export function LogTable() {
  const [search, setSearch] = useUrlState("search");
  const [typeFilter, setTypeFilter] = useUrlState("type");
  const [statusFilter, setStatusFilter] = useUrlState("status");
  const [selectedLog, setSelectedLog] = useState<ActivityEntry | null>(null);
  const [page, setPage] = useUrlNumberState("page", 1);
  const [sortBy, setSortBy] = useUrlState("sortBy", "createdAt") as [SortField, (v: string) => void];
  const [sortOrder, setSortOrder] = useUrlState("sortOrder", "desc") as ["asc" | "desc", (v: string) => void];

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
      ...(typeFilter && { type: typeFilter }),
      ...(statusFilter && { status: statusFilter }),
    });
    const res = await fetch(`/api/dashboard/activity?${params}`);
    return res.json();
  }, [page, search, typeFilter, statusFilter, sortBy, sortOrder]);

  const { data } = usePolling(fetcher, 10000);
  const items: ActivityEntry[] = data?.data || [];
  const stats = data?.stats || {};
  const totalPages: number = data?.totalPages || 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by message..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="w-[140px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {LOG_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="w-[140px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <StatDot color="bg-blue-500" label="Info" count={stats.info ?? 0} />
        <StatDot color="bg-emerald-500" label="Success" count={stats.success ?? 0} />
        <StatDot color="bg-amber-500" label="Warning" count={stats.warning ?? 0} />
        <StatDot color="bg-red-500" label="Error" count={stats.error ?? 0} />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead><SortHeader label="Type" field="type" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead><SortHeader label="Status" field="status" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead className="w-full"><SortHeader label="Message" field="message" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead><SortHeader label="Time" field="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No logs found
                </TableCell>
              </TableRow>
            ) : (
              items.map((log) => (
                <TableRow
                  key={log.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedLog(log)}
                >
                  <TableCell>
                    <TypeBadge type={log.type} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={log.status} />
                  </TableCell>
                  <TableCell className="max-w-[400px] truncate text-sm">
                    {log.message}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(log.createdAt), {
                      addSuffix: true,
                    })}
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

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Detail</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <TypeBadge type={selectedLog.type} />
                <StatusBadge status={selectedLog.status} />
              </div>
              <p className="text-sm">{selectedLog.message}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(selectedLog.createdAt).toLocaleString()}
              </p>
              {selectedLog.details && (
                <pre className="rounded-md bg-muted p-3 text-xs overflow-auto">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
