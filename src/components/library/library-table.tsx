"use client";

import { useState, useMemo, useEffect } from "react";
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
  RefreshCw,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LibraryEntry {
  assetId: number;
  assetName: string;
  downloadUrl: string;
  size: number;
  releaseId: number;
  releaseTag: string;
  dbId: number | null;
  appName: string;
  bundleId: string;
  version: string;
  isTweaked: boolean;
  channelId: string | null;
  fileSize: number;
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

type SortField = "appName" | "bundleId" | "version" | "fileSize" | "releaseTag";

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

const PAGE_SIZE = 20;

export function LibraryTable() {
  // Fetched data
  const [allItems, setAllItems] = useState<LibraryEntry[]>([]);
  const [allChannels, setAllChannels] = useState<string[]>([]);
  const [fetched, setFetched] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Filter / search / sort state
  const [search, setSearch] = useState("");
  const [tweakedFilter, setTweakedFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>("appName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Staged changes state (keyed by assetId)
  const [pendingDeletes, setPendingDeletes] = useState<Set<number>>(new Set());
  const [pendingRenames, setPendingRenames] = useState<Map<number, string>>(new Map());

  // Inline editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  // Apply loading state
  const [applying, setApplying] = useState(false);

  const pendingCount = pendingDeletes.size + pendingRenames.size;

  // Fetch from GitHub
  const fetchLibrary = async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/library");
      const result = await res.json();
      if (result.success) {
        setAllItems(result.data);
        setAllChannels(result.channels || []);
        setFetched(true);
      } else {
        toast.error(result.error || "Failed to fetch library");
      }
    } catch {
      toast.error("Failed to fetch library");
    } finally {
      setFetching(false);
    }
  };

  // Client-side filter + sort + paginate
  const filtered = useMemo(() => {
    let result = allItems;

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.appName.toLowerCase().includes(q) ||
          item.bundleId.toLowerCase().includes(q) ||
          item.assetName.toLowerCase().includes(q)
      );
    }

    // Tweaked filter
    if (tweakedFilter === "true") {
      result = result.filter((item) => item.isTweaked);
    } else if (tweakedFilter === "false") {
      result = result.filter((item) => !item.isTweaked);
    }

    // Channel filter
    if (channelFilter) {
      result = result.filter((item) => item.channelId === channelFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      switch (sortBy) {
        case "appName":
          aVal = (pendingRenames.get(a.assetId) || a.appName).toLowerCase();
          bVal = (pendingRenames.get(b.assetId) || b.appName).toLowerCase();
          break;
        case "bundleId":
          aVal = a.bundleId.toLowerCase();
          bVal = b.bundleId.toLowerCase();
          break;
        case "version":
          aVal = a.version.toLowerCase();
          bVal = b.version.toLowerCase();
          break;
        case "fileSize":
          aVal = a.fileSize;
          bVal = b.fileSize;
          break;
        case "releaseTag":
          aVal = a.releaseTag;
          bVal = b.releaseTag;
          break;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [allItems, search, tweakedFilter, channelFilter, sortBy, sortOrder, pendingRenames]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, tweakedFilter, channelFilter]);

  // Clean up selection when page items change
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const visibleIds = new Set(pageItems.map((item) => item.assetId));
      const next = new Set(Array.from(prev).filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [pageItems]);

  const handleSort = (field: SortField) => {
    if (field === sortBy) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  // Selection handlers
  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const allChecked = pageItems.length > 0 && pageItems.every((i) => selectedIds.has(i.assetId));

  // Pending change handlers
  const markForDeletion = (assetId: number) => {
    const next = new Set(pendingDeletes);
    next.add(assetId);
    setPendingDeletes(next);
    if (pendingRenames.has(assetId)) {
      const nextRenames = new Map(pendingRenames);
      nextRenames.delete(assetId);
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

  const undoPending = (assetId: number) => {
    if (pendingDeletes.has(assetId)) {
      const next = new Set(pendingDeletes);
      next.delete(assetId);
      setPendingDeletes(next);
    }
    if (pendingRenames.has(assetId)) {
      const next = new Map(pendingRenames);
      next.delete(assetId);
      setPendingRenames(next);
    }
  };

  const startRename = (item: LibraryEntry) => {
    setEditingId(item.assetId);
    setEditValue(pendingRenames.get(item.assetId) || item.appName);
  };

  const confirmRename = (item: LibraryEntry) => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== item.appName) {
      const next = new Map(pendingRenames);
      next.set(item.assetId, trimmed);
      setPendingRenames(next);
    } else if (trimmed === item.appName) {
      const next = new Map(pendingRenames);
      next.delete(item.assetId);
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
      // Build deletions with assetId, releaseId, dbId
      const deletions = Array.from(pendingDeletes).map((assetId) => {
        const item = allItems.find((i) => i.assetId === assetId);
        return {
          assetId,
          releaseId: item?.releaseId ?? 0,
          dbId: item?.dbId ?? null,
        };
      });

      // Build renames with dbId (only items that have a DB record can be renamed)
      const renames = Array.from(pendingRenames.entries())
        .map(([assetId, appName]) => {
          const item = allItems.find((i) => i.assetId === assetId);
          return item?.dbId ? { dbId: item.dbId, appName } : null;
        })
        .filter((r): r is { dbId: number; appName: string } => r !== null);

      const res = await fetch("/api/library/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deletions, renames }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(result.message);
        setPendingDeletes(new Set());
        setPendingRenames(new Map());
        setSelectedIds(new Set());
        // Re-fetch to show updated state
        await fetchLibrary();
      } else if (result.applied) {
        toast.error(result.error || "Changes were applied, but publishing failed");
        setPendingDeletes(new Set());
        setPendingRenames(new Map());
        setSelectedIds(new Set());
        await fetchLibrary();
      } else {
        toast.error(result.error || "Failed to apply changes");
      }
    } catch {
      toast.error("Failed to apply changes");
    } finally {
      setApplying(false);
    }
  };

  // Empty state — not yet fetched
  if (!fetched) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
        <Package className="mb-4 h-12 w-12 text-muted-foreground/40" />
        <p className="mb-1 text-lg font-medium text-muted-foreground">
          Library not loaded
        </p>
        <p className="mb-6 text-sm text-muted-foreground/70">
          Fetch current IPAs from GitHub Releases to manage them
        </p>
        <Button onClick={fetchLibrary} disabled={fetching}>
          {fetching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {fetching ? "Fetching..." : "Fetch Library"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: search + filters + re-fetch */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, bundle ID, or file..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={channelFilter}
          onValueChange={(v) => setChannelFilter(v === "all" ? "" : v)}
        >
          <SelectTrigger size="sm" className="w-[160px]">
            <SelectValue placeholder="All channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            {allChannels.map((ch) => (
              <SelectItem key={ch} value={ch}>
                {ch}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={tweakedFilter}
          onValueChange={(v) => setTweakedFilter(v === "all" ? "" : v)}
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
        <Button
          variant="outline"
          size="sm"
          onClick={fetchLibrary}
          disabled={fetching || applying}
        >
          <RefreshCw className={cn("mr-1 h-3 w-3", fetching && "animate-spin")} />
          Refresh
        </Button>
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

      {/* Summary */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} IPA{filtered.length !== 1 ? "s" : ""} found
        {filtered.length !== allItems.length && ` (${allItems.length} total)`}
      </p>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[750px]">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10">
                <Checkbox checked={allChecked} onChange={(checked) => {
                  setSelectedIds(checked ? new Set(pageItems.map((i) => i.assetId)) : new Set());
                }} />
              </TableHead>
              <TableHead><SortHeader label="App" field="appName" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead><SortHeader label="Bundle ID" field="bundleId" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead><SortHeader label="Version" field="version" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead><SortHeader label="Size" field="fileSize" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead>Type</TableHead>
              <TableHead><SortHeader label="Release" field="releaseTag" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {allItems.length === 0 ? "No IPAs found on GitHub" : "No results match your filters"}
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((item) => {
                const isDeleted = pendingDeletes.has(item.assetId);
                const isRenamed = pendingRenames.has(item.assetId);
                const hasPending = isDeleted || isRenamed;
                const displayName = pendingRenames.get(item.assetId) || item.appName;
                const canRename = item.dbId !== null;

                return (
                  <TableRow
                    key={item.assetId}
                    data-state={selectedIds.has(item.assetId) ? "selected" : undefined}
                    className={cn(isDeleted && "opacity-40")}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(item.assetId)}
                        onChange={() => toggleSelect(item.assetId)}
                      />
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      {editingId === item.assetId ? (
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
                      {item.isTweaked ? (
                        <Badge variant="secondary">Tweaked</Badge>
                      ) : (
                        <Badge variant="outline">Stock</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.releaseTag}
                    </TableCell>
                    <TableCell>
                      {hasPending ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => undoPending(item.assetId)}
                          title="Undo"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <div className="flex">
                          {canRename && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => startRename(item)}
                              title="Rename"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => markForDeletion(item.assetId)}
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
