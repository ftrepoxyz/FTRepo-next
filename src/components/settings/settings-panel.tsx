"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Scan,
  FileJson,
  Trash2,
  Database,
  Plus,
  X,
} from "lucide-react";

interface Channel {
  id: number;
  channelId: string;
  channelName: string | null;
  isActive: boolean;
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<Record<string, string | number | boolean>>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [newChannel, setNewChannel] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [settingsRes, channelsRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/channels"),
      ]);
      const settingsData = await settingsRes.json();
      const channelsData = await channelsRes.json();

      if (settingsData.success) setSettings(settingsData.data);
      if (channelsData.success) setChannels(channelsData.data);
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateSetting = async (key: string, value: string | number | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      toast.success("Setting updated");
    } catch {
      toast.error("Failed to update setting");
    }
  };

  const addChannel = async () => {
    if (!newChannel.trim()) return;
    try {
      await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: newChannel.trim(),
          channelName: newChannel.trim(),
        }),
      });
      setNewChannel("");
      toast.success("Channel added");
      loadData();
    } catch {
      toast.error("Failed to add channel");
    }
  };

  const removeChannel = async (channelId: string) => {
    try {
      await fetch(`/api/channels?channelId=${encodeURIComponent(channelId)}`, {
        method: "DELETE",
      });
      toast.success("Channel removed");
      loadData();
    } catch {
      toast.error("Failed to remove channel");
    }
  };

  const runAction = async (action: string, method: string = "POST") => {
    try {
      toast.info(`Running ${action}...`);
      const res = await fetch(`/api/actions/${action}`, { method });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `${action} completed`);
      } else {
        toast.error(data.error || `${action} failed`);
      }
    } catch {
      toast.error(`Failed to run ${action}`);
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-32 rounded-lg bg-muted" />
      ))}
    </div>;
  }

  return (
    <Tabs defaultValue="general">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="integrations">Integrations</TabsTrigger>
        <TabsTrigger value="channels">Channels</TabsTrigger>
        <TabsTrigger value="actions">Admin Actions</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Source Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Repository Name</Label>
                <Input
                  value={String(settings.source_name || "")}
                  onChange={(e) => updateSetting("source_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={String(settings.source_description || "")}
                  onChange={(e) =>
                    updateSetting("source_description", e.target.value)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Intervals & Limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Scan Interval (minutes)</Label>
                <Input
                  type="number"
                  value={String(settings.scan_interval_minutes || 30)}
                  onChange={(e) =>
                    updateSetting("scan_interval_minutes", Number(e.target.value))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>JSON Regen Interval (minutes)</Label>
                <Input
                  type="number"
                  value={String(settings.json_regen_interval_minutes || 60)}
                  onChange={(e) =>
                    updateSetting("json_regen_interval_minutes", Number(e.target.value))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Cleanup Interval (hours)</Label>
                <Input
                  type="number"
                  value={String(settings.cleanup_interval_hours || 24)}
                  onChange={(e) =>
                    updateSetting("cleanup_interval_hours", Number(e.target.value))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Max Versions Per App</Label>
                <Input
                  type="number"
                  value={String(settings.max_versions_per_app || 5)}
                  onChange={(e) =>
                    updateSetting("max_versions_per_app", Number(e.target.value))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Log Retention (days)</Label>
                <Input
                  type="number"
                  value={String(settings.log_retention_days || 30)}
                  onChange={(e) =>
                    updateSetting("log_retention_days", Number(e.target.value))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>App Store Country</Label>
                <Input
                  value={String(settings.appstore_country || "us")}
                  onChange={(e) =>
                    updateSetting("appstore_country", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Temp Directory</Label>
                <Input
                  value={String(settings.temp_dir || "/tmp/ftrepo")}
                  onChange={(e) =>
                    updateSetting("temp_dir", e.target.value)
                  }
                />
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Auto Scan</Label>
                <Switch
                  checked={settings.auto_scan_enabled === true}
                  onCheckedChange={(v) => updateSetting("auto_scan_enabled", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Auto JSON Regeneration</Label>
                <Switch
                  checked={settings.auto_json_regen === true}
                  onCheckedChange={(v) => updateSetting("auto_json_regen", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Auto Cleanup</Label>
                <Switch
                  checked={settings.auto_cleanup === true}
                  onCheckedChange={(v) => updateSetting("auto_cleanup", v)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="integrations" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Telegram</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>API ID</Label>
                <Input
                  type="password"
                  value={String(settings.telegram_api_id || "")}
                  onChange={(e) =>
                    updateSetting("telegram_api_id", e.target.value)
                  }
                  placeholder="Enter Telegram API ID"
                />
              </div>
              <div className="space-y-2">
                <Label>API Hash</Label>
                <Input
                  type="password"
                  value={String(settings.telegram_api_hash || "")}
                  onChange={(e) =>
                    updateSetting("telegram_api_hash", e.target.value)
                  }
                  placeholder="Enter Telegram API Hash"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  type="password"
                  value={String(settings.telegram_phone || "")}
                  onChange={(e) =>
                    updateSetting("telegram_phone", e.target.value)
                  }
                  placeholder="Enter phone number"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>GitHub</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Token</Label>
                <Input
                  type="password"
                  value={String(settings.github_token || "")}
                  onChange={(e) =>
                    updateSetting("github_token", e.target.value)
                  }
                  placeholder="Enter GitHub token"
                />
              </div>
              <div className="space-y-2">
                <Label>Owner</Label>
                <Input
                  value={String(settings.github_owner || "")}
                  onChange={(e) =>
                    updateSetting("github_owner", e.target.value)
                  }
                  placeholder="e.g., my-org"
                />
              </div>
              <div className="space-y-2">
                <Label>Repository</Label>
                <Input
                  value={String(settings.github_repo || "")}
                  onChange={(e) =>
                    updateSetting("github_repo", e.target.value)
                  }
                  placeholder="e.g., my-repo"
                />
              </div>
              <div className="space-y-2">
                <Label>Branch</Label>
                <Input
                  value={String(settings.github_branch || "main")}
                  onChange={(e) =>
                    updateSetting("github_branch", e.target.value)
                  }
                  placeholder="main"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="channels" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Telegram Channels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Channel username (e.g., @channel)"
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addChannel()}
              />
              <Button onClick={addChannel}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {channels.map((ch) => (
                <div
                  key={ch.channelId}
                  className="flex items-center justify-between rounded-md border px-4 py-2"
                >
                  <div>
                    <p className="font-medium">{ch.channelName || ch.channelId}</p>
                    <p className="text-xs text-muted-foreground">
                      {ch.channelId}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={ch.isActive}
                      onCheckedChange={async (active) => {
                        await fetch("/api/channels", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            channelId: ch.channelId,
                            isActive: active,
                          }),
                        });
                        loadData();
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeChannel(ch.channelId)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {channels.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No channels configured
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="actions" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Admin Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => runAction("scan")}
              >
                <Scan className="mr-2 h-4 w-4" />
                Trigger Scan
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => runAction("generate-json")}
              >
                <FileJson className="mr-2 h-4 w-4" />
                Generate JSON
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => runAction("cleanup")}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Run Cleanup
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => runAction("cache", "DELETE")}
              >
                <Database className="mr-2 h-4 w-4" />
                Clear Cache
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
