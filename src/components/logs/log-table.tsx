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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { usePolling } from "@/hooks/use-polling";
import { formatDistanceToNow } from "date-fns";
import type { ActivityEntry } from "@/types/api";

const LOG_TYPES = ["all", "scan", "download", "process", "upload", "cleanup", "generate", "error", "system"];
const LOG_STATUSES = ["all", "info", "success", "warning", "error"];

const statusVariant = (status: string): "default" | "destructive" | "secondary" | "outline" => {
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

export function LogTable() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ActivityEntry | null>(null);

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/dashboard/activity?limit=100");
    const json = await res.json();
    return json.data as ActivityEntry[];
  }, []);

  const { data: logs, refresh } = usePolling(fetcher, 5000, autoRefresh);

  const filteredLogs = (logs || []).filter((log) => {
    if (typeFilter !== "all" && log.type !== typeFilter) return false;
    if (statusFilter !== "all" && log.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {LOG_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t === "all" ? "All Types" : t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {LOG_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All Statuses" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Label htmlFor="auto-refresh" className="text-sm">
            Auto-refresh
          </Label>
          <Switch
            id="auto-refresh"
            checked={autoRefresh}
            onCheckedChange={setAutoRefresh}
          />
          <Button variant="outline" size="sm" onClick={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-full">Message</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No logs found
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow
                  key={log.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedLog(log)}
                >
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {log.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(log.status)} className="text-xs">
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.message}</TableCell>
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

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Detail</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Badge variant="outline">{selectedLog.type}</Badge>
                <Badge variant={statusVariant(selectedLog.status)}>
                  {selectedLog.status}
                </Badge>
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
