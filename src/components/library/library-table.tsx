"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
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
  ChevronDown,
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
  groupKey: string;
  matchedTweak: string | null;
  renameScope: "global" | "feather";
  displayName: string;
}

interface AppGroup {
  key: string;
  displayName: string;
  bundleId: string;
  latest: LibraryEntry;
  versions: LibraryEntry[];
  totalSize: number;
  hasTweaked: boolean;
  hasStock: boolean;
  matchedTweak: string | null;
  renameScope: "global" | "feather";
  hasDatabaseRecord: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return nb - na;
  }
  return 0;
}

function buildGroups(items: LibraryEntry[]): AppGroup[] {
  const map = new Map<string, LibraryEntry[]>();

  for (const item of items) {
    const list = map.get(item.groupKey) || [];
    list.push(item);
    map.set(item.groupKey, list);
  }

  const groups: AppGroup[] = [];

  for (const [key, versions] of map) {
    versions.sort((a, b) => {
      const tagCmp = b.releaseTag.localeCompare(a.releaseTag);
      if (tagCmp !== 0) return tagCmp;
      return compareVersions(a.version, b.version);
    });

    const latest = versions[0];
    groups.push({
      key,
      displayName: latest.displayName,
      bundleId: latest.bundleId,
      latest,
      versions,
      totalSize: versions.reduce((sum, version) => sum + version.fileSize, 0),
      hasTweaked: versions.some((version) => version.isTweaked),
      hasStock: versions.some((version) => !version.isTweaked),
      matchedTweak: latest.matchedTweak,
      renameScope: latest.renameScope,
      hasDatabaseRecord: versions.some((version) => version.dbId !== null),
    });
  }

  return groups;
}

type SortField = "appName" | "bundleId" | "fileSize" | "releaseTag";

function SortHeader({
  label,
  field,
  sortBy,
  sortOrder,
  onSort,
}: {
  label: string;
  field: SortField;
  sortBy: SortField;
  sortOrder: "asc" | "desc";
  onSort: (field: SortField) => void;
}) {
  return (
    <button
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider transition-colors hover:text-foreground",
        sortBy === field ? "text-foreground" : "text-muted-foreground"
      )}
      onClick={() => onSort(field)}
    >
      {label}
      {sortBy === field && (
        <span className="text-[10px]">{sortOrder === "asc" ? "\u25B2" : "\u25BC"}</span>
      )}
    </button>
  );
}

function Checkbox({
  checked,
  indeterminate,
  onChange,
  className,
}: {
  checked?: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <button
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked || indeterminate
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/30 bg-transparent hover:border-muted-foreground/60",
        className
      )}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M2 5L4.5 7.5L8.5 2.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {indeterminate && !checked && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M2.5 5H7.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}

const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];

export function LibraryTable() {
  const [allItems, setAllItems] = useState<LibraryEntry[]>([]);
  const [allChannels, setAllChannels] = useState<string[]>([]);
  const [fetched, setFetched] = useState(false);
  const [fetching, setFetching] = useState(false);

  const [search, setSearch] = useState("");
  const [tweakedFilter, setTweakedFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sortBy, setSortBy] = useState<SortField>("appName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pendingDeletes, setPendingDeletes] = useState<Set<number>>(new Set());
  const [pendingRenames, setPendingRenames] = useState<Map<string, string>>(new Map());

  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [applying, setApplying] = useState(false);

  const pendingCount = pendingDeletes.size + pendingRenames.size;

  const fetchLibrary = useCallback(async () => {
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
  }, []);

  const { groups, totalVersions } = useMemo(() => {
    let items = allItems;

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (item) =>
          item.displayName.toLowerCase().includes(q) ||
          item.appName.toLowerCase().includes(q) ||
          item.bundleId.toLowerCase().includes(q) ||
          item.assetName.toLowerCase().includes(q) ||
          item.version.toLowerCase().includes(q)
      );
    }

    if (tweakedFilter === "true") items = items.filter((item) => item.isTweaked);
    else if (tweakedFilter === "false") items = items.filter((item) => !item.isTweaked);

    if (channelFilter) items = items.filter((item) => item.channelId === channelFilter);

    const grouped = buildGroups(items);

    grouped.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";

      switch (sortBy) {
        case "appName":
          av = (pendingRenames.get(a.key) || a.displayName).toLowerCase();
          bv = (pendingRenames.get(b.key) || b.displayName).toLowerCase();
          break;
        case "bundleId":
          av = a.bundleId.toLowerCase();
          bv = b.bundleId.toLowerCase();
          break;
        case "fileSize":
          av = a.latest.fileSize;
          bv = b.latest.fileSize;
          break;
        case "releaseTag":
          av = a.latest.releaseTag;
          bv = b.latest.releaseTag;
          break;
      }

      if (av < bv) return sortOrder === "asc" ? -1 : 1;
      if (av > bv) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return { groups: grouped, totalVersions: items.length };
  }, [
    allItems,
    search,
    tweakedFilter,
    channelFilter,
    sortBy,
    sortOrder,
    pendingRenames,
  ]);

  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
  const pageGroups = groups.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, tweakedFilter, channelFilter, pageSize]);

  const handleSort = (field: SortField) => {
    if (field === sortBy) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const toggleExpand = (key: string) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedGroups(next);
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleGroupSelect = (group: AppGroup) => {
    const ids = group.versions.map((version) => version.assetId);
    const allSelected = ids.every((id) => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) ids.forEach((id) => next.delete(id));
    else ids.forEach((id) => next.add(id));
    setSelectedIds(next);
  };

  const markForDeletion = (assetId: number) => {
    const next = new Set(pendingDeletes);
    next.add(assetId);
    setPendingDeletes(next);
  };

  const markGroupForDeletion = (group: AppGroup) => {
    const next = new Set(pendingDeletes);
    for (const version of group.versions) next.add(version.assetId);
    setPendingDeletes(next);
  };

  const batchMarkForDeletion = () => {
    const next = new Set(pendingDeletes);
    for (const id of selectedIds) next.add(id);
    setPendingDeletes(next);
    setSelectedIds(new Set());
  };

  const undoPending = (assetId: number) => {
    if (!pendingDeletes.has(assetId)) return;
    const next = new Set(pendingDeletes);
    next.delete(assetId);
    setPendingDeletes(next);
  };

  const undoGroupPending = (group: AppGroup) => {
    const nextDeletes = new Set(pendingDeletes);
    for (const version of group.versions) nextDeletes.delete(version.assetId);

    const nextRenames = new Map(pendingRenames);
    nextRenames.delete(group.key);

    setPendingDeletes(nextDeletes);
    setPendingRenames(nextRenames);
  };

  const startRename = (group: AppGroup) => {
    setEditingGroupKey(group.key);
    setEditValue(pendingRenames.get(group.key) || group.displayName);
  };

  const confirmRename = (group: AppGroup) => {
    const trimmed = editValue.trim();
    const next = new Map(pendingRenames);

    if (trimmed && trimmed !== group.displayName) next.set(group.key, trimmed);
    else next.delete(group.key);

    setPendingRenames(next);
    setEditingGroupKey(null);
  };

  const cancelRename = () => {
    setEditingGroupKey(null);
  };

  const clearAllPending = () => {
    setPendingDeletes(new Set());
    setPendingRenames(new Map());
    setEditingGroupKey(null);
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const deletions = Array.from(pendingDeletes).map((assetId) => {
        const item = allItems.find((entry) => entry.assetId === assetId);
        return {
          assetId,
          releaseId: item?.releaseId ?? 0,
          dbId: item?.dbId ?? null,
        };
      });

      const renames = Array.from(pendingRenames.entries())
        .map(([groupKey, appName]) => {
          const group = groups.find((entry) => entry.key === groupKey);
          if (!group) return null;

          return {
            groupKey,
            bundleId: group.bundleId,
            matchedTweak: group.matchedTweak,
            scope: group.renameScope,
            appName,
          };
        })
        .filter(
          (
            rename
          ): rename is {
            groupKey: string;
            bundleId: string;
            matchedTweak: string | null;
            scope: "global" | "feather";
            appName: string;
          } => rename !== null
        );

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
        setEditingGroupKey(null);
        await fetchLibrary();
      } else if (result.applied) {
        toast.error(result.error || "Changes applied, but publishing failed");
        setPendingDeletes(new Set());
        setPendingRenames(new Map());
        setSelectedIds(new Set());
        setEditingGroupKey(null);
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

  const groupPendingState = (group: AppGroup) => {
    const deletedCount = group.versions.filter((version) =>
      pendingDeletes.has(version.assetId)
    ).length;
    const renamed = pendingRenames.has(group.key);
    const allDeleted = deletedCount === group.versions.length;
    const someChanged = deletedCount > 0 || renamed;
    return { deletedCount, renamed, allDeleted, someChanged };
  };

  const groupSelectionState = (group: AppGroup) => {
    const ids = group.versions.map((version) => version.assetId);
    const selectedCount = ids.filter((id) => selectedIds.has(id)).length;
    return {
      all: selectedCount === ids.length && ids.length > 0,
      some: selectedCount > 0 && selectedCount < ids.length,
    };
  };

  if (!fetched) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/20 py-20">
        <div className="mb-5 rounded-full bg-muted/60 p-4">
          <Package className="h-10 w-10 text-muted-foreground/50" />
        </div>
        <p className="mb-1 text-lg font-semibold tracking-tight">Library not loaded</p>
        <p className="mb-8 max-w-sm text-center text-sm text-muted-foreground">
          Fetch your current IPAs from GitHub Releases to view, rename, or remove them
        </p>
        <Button size="lg" onClick={fetchLibrary} disabled={fetching}>
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Search apps, bundle IDs, versions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={channelFilter}
          onValueChange={(value) => setChannelFilter(value === "all" ? "" : value)}
        >
          <SelectTrigger size="sm" className="w-[150px]">
            <SelectValue placeholder="All channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            {allChannels.map((channel) => (
              <SelectItem key={channel} value={channel}>
                {channel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={tweakedFilter}
          onValueChange={(value) => setTweakedFilter(value === "all" ? "" : value)}
        >
          <SelectTrigger size="sm" className="w-[120px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="true">Tweaked</SelectItem>
            <SelectItem value="false">Stock</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => setPageSize(Number(value))}
        >
          <SelectTrigger size="sm" className="w-[140px]">
            <SelectValue placeholder="Entries" />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option} per page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchLibrary} disabled={fetching || applying}>
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", fetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {(selectedIds.size > 0 || pendingCount > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <Button size="sm" variant="destructive" onClick={batchMarkForDeletion}>
              <Trash2 className="mr-1.5 h-3 w-3" />
              Delete {selectedIds.size} selected
            </Button>
          )}
          {pendingCount > 0 && (
            <div
              className={cn(
                "flex flex-1 items-center justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2",
                selectedIds.size === 0 && "w-full"
              )}
            >
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                {pendingCount} pending change{pendingCount !== 1 ? "s" : ""}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearAllPending}>
                  <Undo2 className="mr-1.5 h-3 w-3" />
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
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{groups.length}</span> app
          {groups.length !== 1 ? "s" : ""}
          {" \u00b7 "}
          <span className="font-medium text-foreground">{totalVersions}</span> version
          {totalVersions !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Sort by</span>
          <SortHeader label="Name" field="appName" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
          <SortHeader label="Bundle" field="bundleId" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
          <SortHeader label="Size" field="fileSize" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
          <SortHeader label="Release" field="releaseTag" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
        </div>
      </div>

      {pageGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/20 py-16">
          <div className="mb-4 rounded-full bg-muted/60 p-3">
            <Package className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground">
            {allItems.length === 0 ? "No IPAs found on GitHub" : "No results match your filters"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pageGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.key);
            const pending = groupPendingState(group);
            const selection = groupSelectionState(group);
            const displayName = pendingRenames.get(group.key) || group.displayName;
            const isRenamed = pendingRenames.has(group.key);

            return (
              <div
                key={group.key}
                className={cn(
                  "overflow-hidden rounded-lg border transition-colors",
                  pending.allDeleted && "opacity-40",
                  pending.someChanged && !pending.allDeleted && "border-amber-500/30",
                  isExpanded && "bg-muted/20"
                )}
              >
                <button
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                    pending.allDeleted && "line-through"
                  )}
                  onClick={() => toggleExpand(group.key)}
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      !isExpanded && "-rotate-90"
                    )}
                  />

                  <Checkbox
                    checked={selection.all}
                    indeterminate={selection.some}
                    onChange={() => toggleGroupSelect(group)}
                  />

                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "truncate text-sm font-semibold",
                            isRenamed && "text-blue-600 dark:text-blue-400"
                          )}
                        >
                          {displayName}
                        </span>
                        {isRenamed && (
                          <span className="shrink-0 text-[10px] text-blue-500/60">(renamed)</span>
                        )}
                        {group.matchedTweak && (
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                            {group.matchedTweak}
                          </Badge>
                        )}
                        {group.renameScope === "feather" && (
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                            Feather only
                          </Badge>
                        )}
                      </div>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {group.bundleId}
                      </p>
                    </div>

                    <span className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs font-medium">
                      v{group.latest.version}
                    </span>

                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                        group.versions.length > 1
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {group.versions.length} ver{group.versions.length !== 1 ? "s" : ""}
                    </span>

                    <div className="hidden shrink-0 gap-1 sm:flex">
                      {group.hasStock && (
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                          Stock
                        </Badge>
                      )}
                      {group.hasTweaked && (
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                          Tweaked
                        </Badge>
                      )}
                    </div>

                    <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground lg:block">
                      {formatBytes(group.latest.fileSize)}
                    </span>

                    <span className="hidden shrink-0 text-xs text-muted-foreground xl:block">
                      {group.latest.releaseTag}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    {pending.someChanged ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => undoGroupPending(group)}
                        title="Undo all changes in this group"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <>
                        {group.hasDatabaseRecord && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => startRename(group)}
                            title={
                              group.renameScope === "feather"
                                ? "Rename this Feather variant"
                                : "Rename app"
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => markGroupForDeletion(group)}
                          title="Delete all versions"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </button>

                {editingGroupKey === group.key && (
                  <div
                    className="flex items-center gap-2 border-t px-4 py-2 pl-[4.5rem]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmRename(group);
                        if (e.key === "Escape") cancelRename();
                      }}
                      className="h-8 max-w-sm text-sm"
                      autoFocus
                      placeholder="New app name..."
                    />
                    {group.renameScope === "feather" && (
                      <p className="text-xs text-muted-foreground">
                        Updates Feather only for this known tweak variant.
                      </p>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => confirmRename(group)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={cancelRename}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {isExpanded && (
                  <div className="border-t">
                    <div className="grid grid-cols-[2.5rem_1fr_5rem_5rem_5.5rem_5rem] items-center gap-2 px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                      <span />
                      <span>Version</span>
                      <span>Size</span>
                      <span>Type</span>
                      <span>Release</span>
                      <span />
                    </div>

                    {group.versions.map((version, idx) => {
                      const isDeleted = pendingDeletes.has(version.assetId);
                      const groupRename = pendingRenames.get(group.key);
                      const isLatest = idx === 0;

                      return (
                        <div
                          key={version.assetId}
                          className={cn(
                            "grid grid-cols-[2.5rem_1fr_5rem_5rem_5.5rem_5rem] items-center gap-2 px-4 py-2 transition-colors hover:bg-muted/30",
                            isDeleted && "opacity-40",
                            idx < group.versions.length - 1 && "border-b border-border/50"
                          )}
                        >
                          <div className="flex justify-center">
                            <Checkbox
                              checked={selectedIds.has(version.assetId)}
                              onChange={() => toggleSelect(version.assetId)}
                            />
                          </div>

                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={cn(
                                "font-mono text-sm font-medium",
                                isDeleted && "line-through"
                              )}
                            >
                              v{version.version}
                            </span>
                            {isLatest && (
                              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                latest
                              </span>
                            )}
                            {groupRename && (
                              <span className="truncate text-xs text-blue-500">
                                {groupRename}
                                <span className="ml-1 text-[10px] text-blue-500/60">(group rename)</span>
                              </span>
                            )}
                          </div>

                          <span className="text-xs tabular-nums text-muted-foreground">
                            {formatBytes(version.fileSize)}
                          </span>

                          <div>
                            {version.isTweaked ? (
                              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                                Tweaked
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                Stock
                              </Badge>
                            )}
                          </div>

                          <span className="text-xs text-muted-foreground">{version.releaseTag}</span>

                          <div className="flex justify-end">
                            {isDeleted ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => undoPending(version.assetId)}
                                title="Undo delete"
                              >
                                <Undo2 className="h-3 w-3" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => markForDeletion(version.assetId)}
                                title="Delete"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
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
      )}
    </div>
  );
}
