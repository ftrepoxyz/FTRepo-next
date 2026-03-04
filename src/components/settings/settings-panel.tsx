"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Scan,
  FileJson,
  Trash2,
  Database,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plug,
  Unplug,
  Play,
  Save,
  Undo2,
  Bomb,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { UsersTab } from "@/components/settings/users-tab";

function UnsavedBanner({
  show,
  saving,
  onSave,
  onDiscard,
}: {
  show: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  if (!show) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-40 mb-4 flex items-center justify-between gap-4 rounded-lg border border-border bg-muted px-4 py-3"
    >
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 text-yellow-500" />
        <p className="text-sm font-medium">Unsaved changes</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={onDiscard}>
          <Undo2 className="mr-1.5 h-3.5 w-3.5" />
          Discard
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" />
          )}
          Save
        </Button>
      </div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => {
        // Allow only digits (and empty for clearing)
        if (/^\d*$/.test(e.target.value)) {
          setDraft(e.target.value);
        }
      }}
      onBlur={() => {
        const parsed = parseInt(draft, 10);
        if (isNaN(parsed) || (min !== undefined && parsed < min)) {
          setDraft(String(value));
        } else {
          onChange(parsed);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
    />
  );
}

interface ForumTopic {
  id: number;
  name: string;
  iconColor: number;
  enabled: boolean;
}

interface Channel {
  id: number;
  channelId: string;
  channelName: string | null;
  channelDescription: string | null;
  isActive: boolean;
  isForum: boolean;
  forumTopics: ForumTopic[];
}

type SettingsMap = Record<string, string | number | boolean | string[]>;

const VALID_TABS = ["general", "integrations", "channels", "users", "actions"];

function getInitialTab(): string {
  if (typeof window === "undefined") return "general";
  const hash = window.location.hash.slice(1);
  return VALID_TABS.includes(hash) ? hash : "general";
}

export function SettingsPanel() {
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [savedSettings, setSavedSettings] = useState<SettingsMap>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [savedChannels, setSavedChannels] = useState<Channel[]>([]);
  const [newChannel, setNewChannel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ role: string } | null>(null);
  const [telegramAuth, setTelegramAuth] = useState<{
    state: string;
    error: string | null;
    passwordHint: string;
  }>({ state: "disconnected", error: null, passwordHint: "" });
  const [authCode, setAuthCode] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [githubBranches, setGithubBranches] = useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  const fetchBranches = useCallback(async () => {
    setBranchesLoading(true);
    try {
      const res = await fetch("/api/github/branches");
      const data = await res.json();
      if (data.success) {
        setGithubBranches(data.data);
      } else {
        setGithubBranches([]);
      }
    } catch {
      setGithubBranches([]);
    } finally {
      setBranchesLoading(false);
    }
  }, []);

  const changeTab = useCallback((tab: string) => {
    setActiveTab(tab);
    window.history.replaceState(null, "", `#${tab}`);
    if (tab === "integrations") {
      fetchBranches();
    }
  }, [fetchBranches]);

  const isDirty = useMemo(() => {
    const keys = new Set([...Object.keys(settings), ...Object.keys(savedSettings)]);
    for (const key of keys) {
      const a = settings[key];
      const b = savedSettings[key];
      if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length || a.some((v, i) => v !== b[i])) return true;
      } else if (a !== b) {
        return true;
      }
    }
    // Check for forum topic changes
    for (const ch of channels) {
      const saved = savedChannels.find((s) => s.channelId === ch.channelId);
      if (!saved) continue;
      if (ch.forumTopics?.length !== saved.forumTopics?.length) return true;
      for (let i = 0; i < (ch.forumTopics?.length ?? 0); i++) {
        if (ch.forumTopics[i]?.enabled !== saved.forumTopics[i]?.enabled) return true;
      }
    }
    return false;
  }, [settings, savedSettings, channels, savedChannels]);

  const isDirtyRef = useRef(false);
  isDirtyRef.current = isDirty;

  // Prevent browser/tab close with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const loadTelegramAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/telegram");
      const data = await res.json();
      if (data.success) {
        setTelegramAuth({
          state: data.state,
          error: data.error,
          passwordHint: data.passwordHint,
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [settingsRes, channelsRes, meRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/channels"),
        fetch("/api/auth/me"),
      ]);
      const settingsData = await settingsRes.json();
      const channelsData = await channelsRes.json();
      const meData = await meRes.json();

      if (settingsData.success) {
        setSettings(settingsData.data);
        setSavedSettings(settingsData.data);
        fetchBranches();
      }
      if (channelsData.success) {
        setChannels(channelsData.data);
        setSavedChannels(channelsData.data);
      }
      if (meData.success) setCurrentUser(meData.user);
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
    loadTelegramAuth();
  }, [loadTelegramAuth, fetchBranches]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [expandedForums, setExpandedForums] = useState<Set<string>>(new Set());
  const [refreshingTopics, setRefreshingTopics] = useState<Set<string>>(new Set());

  const toggleForumExpanded = (channelId: string) => {
    setExpandedForums((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  };

  const toggleTopicEnabled = (
    channel: Channel,
    topicId: number,
    enabled: boolean
  ) => {
    const updatedTopics = channel.forumTopics.map((t) =>
      t.id === topicId ? { ...t, enabled } : t
    );
    setChannels((prev) =>
      prev.map((ch) =>
        ch.channelId === channel.channelId
          ? { ...ch, forumTopics: updatedTopics }
          : ch
      )
    );
  };

  const refreshTopics = async (channelId: string) => {
    setRefreshingTopics((prev) => new Set(prev).add(channelId));
    try {
      const res = await fetch("/api/channels/refresh-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      const data = await res.json();
      if (data.success) {
        const update = (ch: Channel) =>
          ch.channelId === channelId
            ? { ...ch, isForum: data.data.isForum, forumTopics: data.data.forumTopics }
            : ch;
        setChannels((prev) => prev.map(update));
        setSavedChannels((prev) => prev.map(update));
        toast.success("Topics refreshed");
      } else {
        toast.error(data.error || "Failed to refresh topics");
      }
    } catch {
      toast.error("Failed to refresh topics");
    } finally {
      setRefreshingTopics((prev) => {
        const next = new Set(prev);
        next.delete(channelId);
        return next;
      });
    }
  };

  const [newTweak, setNewTweak] = useState("");
  const [nukeOpen, setNukeOpen] = useState(false);
  const [nukeLoading, setNukeLoading] = useState(false);
  const [nukeConfirm, setNukeConfirm] = useState("");

  const updateSetting = (key: string, value: string | number | boolean | string[]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const saveAllSettings = async () => {
    setSaving(true);
    try {
      const changed: SettingsMap = {};
      for (const key of Object.keys(settings)) {
        const a = settings[key];
        const b = savedSettings[key];
        if (Array.isArray(a) && Array.isArray(b)) {
          if (a.length !== b.length || a.some((v, i) => v !== b[i])) changed[key] = a;
        } else if (a !== b) {
          changed[key] = a;
        }
      }

      // Save settings + dirty forum topic changes in parallel
      const topicSaves: Promise<unknown>[] = [];
      for (const ch of channels) {
        const saved = savedChannels.find((s) => s.channelId === ch.channelId);
        if (!saved) continue;
        const hasChanges =
          ch.forumTopics?.length !== saved.forumTopics?.length ||
          ch.forumTopics?.some((t, i) => t.enabled !== saved.forumTopics[i]?.enabled);
        if (hasChanges) {
          topicSaves.push(
            fetch("/api/channels", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                channelId: ch.channelId,
                forumTopics: ch.forumTopics,
              }),
            })
          );
        }
      }

      await Promise.all([
        fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changed),
        }),
        ...topicSaves,
      ]);

      setSavedSettings({ ...settings });
      setSavedChannels(channels.map((ch) => ({ ...ch })));
      toast.success("Settings saved");
      fetchBranches();
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    setSettings({ ...savedSettings });
    setChannels(savedChannels.map((ch) => ({ ...ch })));
  };

  const telegramAuthAction = async (
    action: string,
    body?: Record<string, string>
  ) => {
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json();
      setTelegramAuth({
        state: data.state,
        error: data.error,
        passwordHint: data.passwordHint,
      });
      if (data.state === "ready") {
        toast.success("Telegram connected");
        setAuthCode("");
        setAuthPassword("");
      } else if (data.state === "disconnected") {
        toast.success("Telegram disconnected");
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch {
      toast.error("Failed to communicate with Telegram");
    } finally {
      setAuthLoading(false);
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
    <>
      <UnsavedBanner
        show={isDirty}
        saving={saving}
        onSave={saveAllSettings}
        onDiscard={discardChanges}
      />
    <Tabs value={activeTab} onValueChange={changeTab}>
      {/* Mobile: Select dropdown */}
      <div className="md:hidden">
        <Select value={activeTab} onValueChange={changeTab}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="integrations">Integrations</SelectItem>
            <SelectItem value="channels">Channels</SelectItem>
            {currentUser?.role === "admin" && (
              <SelectItem value="users">Users</SelectItem>
            )}
            <SelectItem value="actions">Scraper</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: Tab bar */}
      <div className="hidden md:block">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          {currentUser?.role === "admin" && (
            <TabsTrigger value="users">Users</TabsTrigger>
          )}
          <TabsTrigger value="actions">Scraper</TabsTrigger>
        </TabsList>
      </div>

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
              <div className="space-y-2">
                <Label>Site Domain</Label>
                <Input
                  value={String(settings.site_domain || "")}
                  onChange={(e) =>
                    updateSetting("site_domain", e.target.value)
                  }
                  placeholder="e.g., ftrepo.xyz"
                />
                <p className="text-xs text-muted-foreground">
                  Custom domain for short source URLs
                </p>
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
                <NumberInput
                  value={Number(settings.scan_interval_minutes) || 30}
                  min={1}
                  onChange={(v) => updateSetting("scan_interval_minutes", v)}
                />
              </div>
              <div className="space-y-2">
                <Label>JSON Regen Interval (minutes)</Label>
                <NumberInput
                  value={Number(settings.json_regen_interval_minutes) || 60}
                  min={1}
                  onChange={(v) => updateSetting("json_regen_interval_minutes", v)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cleanup Interval (hours)</Label>
                <NumberInput
                  value={Number(settings.cleanup_interval_hours) || 24}
                  min={1}
                  onChange={(v) => updateSetting("cleanup_interval_hours", v)}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Versions Per App</Label>
                <NumberInput
                  value={Number(settings.max_versions_per_app) || 5}
                  min={1}
                  onChange={(v) => updateSetting("max_versions_per_app", v)}
                />
              </div>
              <div className="space-y-2">
                <Label>Log Retention (days)</Label>
                <NumberInput
                  value={Number(settings.log_retention_days) || 30}
                  min={1}
                  onChange={(v) => updateSetting("log_retention_days", v)}
                />
              </div>
              <div className="space-y-2">
                <Label>Scan Messages per Run</Label>
                <NumberInput
                  value={Number(settings.scan_message_limit) || 500}
                  min={0}
                  placeholder="500"
                  onChange={(v) => updateSetting("scan_message_limit", v)}
                />
                <p className="text-xs text-muted-foreground">
                  Max messages to scan per channel per run (0 = unlimited)
                </p>
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

        <Card>
          <CardHeader>
            <CardTitle>Known Tweaks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tweak names used to distinguish apps with the same bundle ID. When multiple tweaks target the same app, they appear as separate entries in your repo JSON.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Tweak name (e.g., Watusi)"
                value={newTweak}
                onChange={(e) => setNewTweak(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTweak.trim()) {
                    const current = (settings.known_tweaks as unknown as string[]) || [];
                    if (!current.includes(newTweak.trim())) {
                      updateSetting("known_tweaks", [...current, newTweak.trim()]);
                    }
                    setNewTweak("");
                  }
                }}
              />
              <Button
                onClick={() => {
                  if (!newTweak.trim()) return;
                  const current = (settings.known_tweaks as unknown as string[]) || [];
                  if (!current.includes(newTweak.trim())) {
                    updateSetting("known_tweaks", [...current, newTweak.trim()]);
                  }
                  setNewTweak("");
                }}
              >
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {((settings.known_tweaks as unknown as string[]) || []).map((tweak) => (
                <div
                  key={tweak}
                  className="flex items-center gap-1 rounded-md border px-3 py-1 text-sm"
                >
                  <span>{tweak}</span>
                  <button
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      const current = (settings.known_tweaks as unknown as string[]) || [];
                      updateSetting("known_tweaks", current.filter((t) => t !== tweak));
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {((settings.known_tweaks as unknown as string[]) || []).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No tweaks configured
                </p>
              )}
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
                  value={String(settings.telegram_phone || "")}
                  onChange={(e) =>
                    updateSetting("telegram_phone", e.target.value)
                  }
                  placeholder="Enter phone number (e.g., +1234567890)"
                />
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {telegramAuth.state === "ready" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : telegramAuth.state === "connecting" ||
                    telegramAuth.state === "waiting_code" ||
                    telegramAuth.state === "waiting_password" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                  ) : telegramAuth.state === "error" ? (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">
                    {telegramAuth.state === "ready"
                      ? "Connected"
                      : telegramAuth.state === "connecting"
                        ? "Connecting..."
                        : telegramAuth.state === "waiting_code"
                          ? "Verification code sent"
                          : telegramAuth.state === "waiting_password"
                            ? "2FA password required"
                            : telegramAuth.state === "error"
                              ? "Connection failed"
                              : "Not connected"}
                  </span>
                </div>
                {telegramAuth.state === "ready" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={authLoading}
                    onClick={() => telegramAuthAction("disconnect")}
                  >
                    <Unplug className="mr-1 h-4 w-4" />
                    Disconnect
                  </Button>
                ) : telegramAuth.state !== "waiting_code" &&
                  telegramAuth.state !== "waiting_password" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={authLoading}
                    onClick={() => telegramAuthAction("connect")}
                  >
                    {authLoading ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Plug className="mr-1 h-4 w-4" />
                    )}
                    Connect
                  </Button>
                ) : null}
              </div>
              {telegramAuth.state === "waiting_code" && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter verification code"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      authCode &&
                      telegramAuthAction("code", { code: authCode })
                    }
                  />
                  <Button
                    disabled={authLoading || !authCode}
                    onClick={() =>
                      telegramAuthAction("code", { code: authCode })
                    }
                  >
                    {authLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Verify"
                    )}
                  </Button>
                </div>
              )}
              {telegramAuth.state === "waiting_password" && (
                <div className="space-y-2">
                  {telegramAuth.passwordHint && (
                    <p className="text-xs text-muted-foreground">
                      Hint: {telegramAuth.passwordHint}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Enter 2FA password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        authPassword &&
                        telegramAuthAction("password", {
                          password: authPassword,
                        })
                      }
                    />
                    <Button
                      disabled={authLoading || !authPassword}
                      onClick={() =>
                        telegramAuthAction("password", {
                          password: authPassword,
                        })
                      }
                    >
                      {authLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Submit"
                      )}
                    </Button>
                  </div>
                </div>
              )}
              {telegramAuth.error && (
                <p className="text-xs text-red-500">{telegramAuth.error}</p>
              )}
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
                <Label>Branch</Label>
                {githubBranches.length > 0 ? (
                  <Select
                    value={String(settings.github_branch || "main")}
                    onValueChange={(v) => updateSetting("github_branch", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {githubBranches.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={String(settings.github_branch || "main")}
                    onChange={(e) =>
                      updateSetting("github_branch", e.target.value)
                    }
                    placeholder="main"
                    disabled={branchesLoading}
                  />
                )}
                {!savedSettings.github_owner || !savedSettings.github_repo ? (
                  <p className="text-xs text-muted-foreground">
                    Save owner and repository to load branches
                  </p>
                ) : branchesLoading ? (
                  <p className="text-xs text-muted-foreground">
                    Loading branches...
                  </p>
                ) : null}
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
              {channels.map((ch) => {
                const enabledCount = ch.forumTopics?.filter((t) => t.enabled).length ?? 0;
                const totalTopics = ch.forumTopics?.length ?? 0;
                const isExpanded = expandedForums.has(ch.channelId);
                const isRefreshing = refreshingTopics.has(ch.channelId);

                return (
                <div
                  key={ch.channelId}
                  className="rounded-lg border"
                >
                  <div className="flex items-center gap-4 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium leading-none">
                          {ch.channelName || ch.channelId}
                        </p>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                          {ch.channelId}
                        </span>
                      </div>
                      {ch.channelDescription && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                          {ch.channelDescription}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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

                  {ch.isForum && totalTopics > 0 && (
                    <div className="border-t px-4 py-2">
                      <div className="flex items-center justify-between">
                        <button
                          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => toggleForumExpanded(ch.channelId)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          Forum &middot; {totalTopics} topics ({enabledCount} enabled)
                        </button>
                        <button
                          className="text-muted-foreground hover:text-foreground transition-colors p-1"
                          onClick={() => refreshTopics(ch.channelId)}
                          disabled={isRefreshing}
                          title="Refresh topics from Telegram"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                          />
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="mt-2 space-y-1 pb-1">
                          {ch.forumTopics.map((topic) => (
                            <label
                              key={topic.id}
                              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50 cursor-pointer"
                            >
                              <Checkbox
                                checked={topic.enabled}
                                onCheckedChange={(checked) =>
                                  toggleTopicEnabled(ch, topic.id, checked === true)
                                }
                              />
                              <span className={topic.enabled ? "" : "text-muted-foreground line-through"}>
                                {topic.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
              {channels.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No channels configured
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      {currentUser?.role === "admin" && (
        <TabsContent value="users" className="space-y-4">
          <UsersTab />
        </TabsContent>
      )}

      <TabsContent value="actions" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Scraper</CardTitle>
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
                onClick={() => runAction("process")}
              >
                <Play className="mr-2 h-4 w-4" />
                Process Queue
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

        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Permanently delete all queue entries, downloaded IPAs from the database, and all GitHub releases. This action cannot be undone.
            </p>
            <Button
              variant="destructive"
              className="justify-start"
              onClick={() => {
                setNukeConfirm("");
                setNukeOpen(true);
              }}
            >
              <Bomb className="mr-2 h-4 w-4" />
              Nuke Everything
            </Button>
          </CardContent>
        </Card>

        <Dialog open={nukeOpen} onOpenChange={setNukeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-600 dark:text-red-400">
                Are you absolutely sure?
              </DialogTitle>
              <DialogDescription>
                This will permanently delete <strong>all queue entries</strong>, <strong>all downloaded IPAs</strong> from the database, and <strong>all GitHub releases</strong>. Channel scan progress will be reset. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>
                Type <span className="font-mono font-bold">NUKE</span> to confirm
              </Label>
              <Input
                value={nukeConfirm}
                onChange={(e) => setNukeConfirm(e.target.value)}
                placeholder="NUKE"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNukeOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={nukeConfirm !== "NUKE" || nukeLoading}
                onClick={async () => {
                  setNukeLoading(true);
                  try {
                    toast.info("Nuking everything...");
                    const res = await fetch("/api/actions/nuke", { method: "POST" });
                    const data = await res.json();
                    if (data.success) {
                      toast.success(data.message);
                    } else {
                      toast.error(data.error || "Nuke failed");
                    }
                  } catch {
                    toast.error("Nuke request failed");
                  } finally {
                    setNukeLoading(false);
                    setNukeOpen(false);
                    setNukeConfirm("");
                  }
                }}
              >
                {nukeLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Bomb className="mr-2 h-4 w-4" />
                )}
                Nuke Everything
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TabsContent>

    </Tabs>
    </>
  );
}
