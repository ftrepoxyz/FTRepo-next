"use client";

import { useState, useCallback, useEffect } from "react";
import { useUrlState, useUrlNumberState } from "@/hooks/use-url-state";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePolling } from "@/hooks/use-polling";
import { formatDistanceToNow } from "date-fns";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  Pencil,
  Undo2,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LibraryEntry {
  id: number;
  bundleId: string;
  appName: string;
  version: string;
  fileSize: number;
  isTweaked: boolean;
  isCorrupted: boolean;
  channelId: string | null;
  tweaks: string[] | null;
  createdAt: string;
}

const EMPTY_ITEMS: LibraryEntry[] = [];
const EMPTY_CHANNELS: string[] = [];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

type SortField = "appName" | "bundleId" | "version" | "fileSize" | "createdAt";

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

export function LibraryTable() {
  // URL-persisted state
  const [search, setSearch] = useUrlState("search");
  const [tweakedFilter, setTweakedFilter] = useUrlState("tweaked");
  const [channelFilter, setChannelFilter] = useUrlState("channel");
  const [page, setPage] = useUrlNumberState("page", 1);
  const [sortBy, setSortBy] = useUrlState("sortBy", "createdAt") as [SortField, (v: string) => void];
  const [sortOrder, setSortOrder] = useUrlState("sortOrder", "desc") as ["asc" | "desc", (v: string) => void];

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Staged changes state
  const [pendingDeletes, setPendingDeletes] = useState<Set<number>>(new Set());
  const [pendingRenames, setPendingRenames] = useState<Map<number, string>>(new Map());

  // Inline editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  // Apply loading state
  const [applying, setApplying] = useState(false);

  const pendingCount = pendingDeletes.size + pendingRenames.size;

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
      ...(tweakedFilter && { tweaked: tweakedFilter }),
      ...(channelFilter && { channelId: channelFilter }),
    });
    const res = await fetch(`/api/database?${params}`);
    return res.json();
  }, [page, search, tweakedFilter, channelFilter, sortBy, sortOrder]);

  const { data, refresh } = usePolling(fetcher, 30000);
  const items: LibraryEntry[] = data?.data ?? EMPTY_ITEMS;
  const totalPages: number = data?.totalPages || 1;
  const channels: string[] = data?.channels ?? EMPTY_CHANNELS;

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;

      const visibleIds = new Set(items.map((item) => item.id));
      const next = new Set(Array.from(prev).filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  // Selection handlers
  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const allChecked = items.length > 0 && items.every((i) => selectedIds.has(i.id));

  // Pending change handlers
  const markForDeletion = (id: number) => {
    const next = new Set(pendingDeletes);
    next.add(id);
    setPendingDeletes(next);
    // Remove from renames if also pending rename
    if (pendingRenames.has(id)) {
      const nextRenames = new Map(pendingRenames);
      nextRenames.delete(id);
      setPendingRenames(nextRenames);
    }
  };

  const batchMarkForDeletion = () => {
    const next = new Set(pendingDeletes);
    const nextRenames = new Map(pendingRenames);

    for (const id of selectedIds) {
      next.add(id);
      nextRenames.delete(id);
    }

    setPendingDeletes(next);
    setPendingRenames(nextRenames);
    setSelectedIds(new Set());
  };

  const undoPending = (id: number) => {
    if (pendingDeletes.has(id)) {
      const next = new Set(pendingDeletes);
      next.delete(id);
      setPendingDeletes(next);
    }
    if (pendingRenames.has(id)) {
      const next = new Map(pendingRenames);
      next.delete(id);
      setPendingRenames(next);
    }
  };

  const startRename = (item: LibraryEntry) => {
    setEditingId(item.id);
    setEditValue(pendingRenames.get(item.id) || item.appName);
  };

  const confirmRename = (item: LibraryEntry) => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== item.appName) {
      const next = new Map(pendingRenames);
      next.set(item.id, trimmed);
      setPendingRenames(next);
    } else if (trimmed === item.appName) {
      // Undo rename if reverted to original
      const next = new Map(pendingRenames);
      next.delete(item.id);
      setPendingRenames(next);
    }
    setEditingId(null);
  };

  const cancelRename = () => {
    setEditingId(null);
  };

  const clearAllPending = () => {
    setPendingDeletes(new Set());
    setPendingRenames(new Map());
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const res = await fetch("/api/library/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deletions: Array.from(pendingDeletes),
          renames: Array.from(pendingRenames.entries()).map(([id, appName]) => ({ id, appName })),
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(result.message);
        setPendingDeletes(new Set());
        setPendingRenames(new Map());
        setSelectedIds(new Set());
        refresh();
      } else if (result.applied) {
        toast.error(result.error || "Changes were applied, but publishing failed");
        setPendingDeletes(new Set());
        setPendingRenames(new Map());
        setSelectedIds(new Set());
        refresh();
      } else {
        toast.error(result.error || "Failed to apply changes");
      }
    } catch {
      toast.error("Failed to apply changes");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar: search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or bundle ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={channelFilter}
          onValueChange={(v) => {
            setChannelFilter(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="w-[160px]">
            <SelectValue placeholder="All channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            {channels.map((ch) => (
              <SelectItem key={ch} value={ch}>
                {ch}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={tweakedFilter}
          onValueChange={(v) => {
            setTweakedFilter(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="w-[130px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="true">Tweaked</SelectItem>
            <SelectItem value="false">Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Batch actions + pending changes bar */}
      <div className="flex flex-wrap items-center gap-2">
        {selectedIds.size > 0 && (
          <Button
            size="sm"
            variant="destructive"
            onClick={batchMarkForDeletion}
          >
            <Trash2 className="mr-1 h-3 w-3" /> Delete ({selectedIds.size})
          </Button>
        )}

        {pendingCount > 0 && (
          <div className={cn(
            "flex flex-1 items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2",
            selectedIds.size === 0 && "w-full"
          )}>
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
              {pendingCount} pending change{pendingCount !== 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clearAllPending}>
                Discard All
              </Button>
              <Button size="sm" onClick={handleApply} disabled={applying}>
                {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apply Changes
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[750px]">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10">
                <Checkbox checked={allChecked} onChange={(checked) => {
                  setSelectedIds(checked ? new Set(items.map((i) => i.id)) : new Set());
                }} />
              </TableHead>
              <TableHead><SortHeader label="App" field="appName" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead><SortHeader label="Bundle ID" field="bundleId" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead><SortHeader label="Version" field="version" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead><SortHeader label="Size" field="fileSize" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead>Type</TableHead>
              <TableHead><SortHeader label="Added" field="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No IPAs found
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const isDeleted = pendingDeletes.has(item.id);
                const isRenamed = pendingRenames.has(item.id);
                const hasPending = isDeleted || isRenamed;
                const displayName = pendingRenames.get(item.id) || item.appName;

                return (
                  <TableRow
                    key={item.id}
                    data-state={selectedIds.has(item.id) ? "selected" : undefined}
                    className={cn(isDeleted && "opacity-40")}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      {editingId === item.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") confirmRename(item);
                              if (e.key === "Escape") cancelRename();
                            }}
                            className="h-7 text-sm"
                            autoFocus
                          />
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => confirmRename(item)}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={cancelRename}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className={cn(
                            "truncate font-medium",
                            isDeleted && "line-through",
                            isRenamed && "text-blue-600 dark:text-blue-400"
                          )}>
                            {displayName}
                          </span>
                          {isRenamed && (
                            <span className="shrink-0 text-[10px] text-blue-500/70">(renamed)</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className={cn("font-mono text-xs text-muted-foreground", isDeleted && "line-through")}>
                      {item.bundleId}
                    </TableCell>
                    <TableCell className={cn("text-sm", isDeleted && "line-through")}>
                      {item.version}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {formatBytes(item.fileSize)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {item.isTweaked ? (
                          <Badge variant="secondary">Tweaked</Badge>
                        ) : (
                          <Badge variant="outline">Stock</Badge>
                        )}
                        {item.isCorrupted && (
                          <Badge variant="destructive">Corrupted</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(item.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell>
                      {hasPending ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => undoPending(item.id)}
                          title="Undo"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <div className="flex">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => startRename(item)}
                            title="Rename"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => markForDeletion(item.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
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
