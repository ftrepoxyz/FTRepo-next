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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePolling } from "@/hooks/use-polling";
import { formatDistanceToNow } from "date-fns";
import { Search, ChevronLeft, ChevronRight, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface IpaEntry {
  id: number;
  bundleId: string;
  appName: string;
  version: string;
  fileSize: number;
  isTweaked: boolean;
  isCorrupted: boolean;
  channelId: string | null;
  downloadUrl: string | null;
  iconUrl: string | null;
  description: string | null;
  developerName: string | null;
  tweaks: string[] | null;
  entitlements: Record<string, string> | null;
  privacyInfo: Record<string, string> | null;
  createdAt: string;
}

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
  const Icon = sortBy !== field ? ArrowUpDown : sortOrder === "asc" ? ArrowUp : ArrowDown;
  return (
    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => onSort(field)}>
      {label}
      <Icon className="h-3 w-3" />
    </button>
  );
}

export function IpaTable() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<IpaEntry | null>(null);

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
    const res = await fetch(`/api/database?${params}`);
    return res.json();
  }, [page, search, sortBy, sortOrder]);

  const { data, loading } = usePolling(fetcher, 30000);
  const ipas: IpaEntry[] = data?.data || [];
  const totalPages: number = data?.totalPages || 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
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
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortHeader label="App" field="appName" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead><SortHeader label="Bundle ID" field="bundleId" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead><SortHeader label="Version" field="version" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead><SortHeader label="Size" field="fileSize" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead>Status</TableHead>
              <TableHead><SortHeader label="Added" field="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && ipas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : ipas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No IPAs found
                </TableCell>
              </TableRow>
            ) : (
              ipas.map((ipa) => (
                <TableRow
                  key={ipa.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(ipa)}
                >
                  <TableCell className="font-medium">{ipa.appName}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {ipa.bundleId}
                  </TableCell>
                  <TableCell>{ipa.version}</TableCell>
                  <TableCell>{formatBytes(ipa.fileSize)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {ipa.isTweaked && (
                        <Badge variant="secondary">Tweaked</Badge>
                      )}
                      {ipa.isCorrupted && (
                        <Badge variant="destructive">Corrupted</Badge>
                      )}
                      {!ipa.isTweaked && !ipa.isCorrupted && (
                        <Badge variant="outline">Stock</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(ipa.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    {ipa.downloadUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(ipa.downloadUrl!, "_blank");
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
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

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.appName}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Bundle ID</p>
                  <p className="font-mono">{selected.bundleId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Version</p>
                  <p>{selected.version}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Developer</p>
                  <p>{selected.developerName || "Unknown"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Size</p>
                  <p>{formatBytes(selected.fileSize)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Channel</p>
                  <p>{selected.channelId || "N/A"}</p>
                </div>
              </div>

              {selected.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-sm">{selected.description}</p>
                </div>
              )}

              {selected.tweaks && selected.tweaks.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Tweaks</p>
                  <div className="flex flex-wrap gap-1">
                    {selected.tweaks.map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selected.entitlements &&
                Object.keys(selected.entitlements).length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Entitlements
                    </p>
                    <div className="mt-1 space-y-1">
                      {Object.entries(selected.entitlements).map(
                        ([key, val]) => (
                          <div key={key} className="text-xs">
                            <span className="font-mono text-muted-foreground">
                              {key}
                            </span>
                            : {val}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
