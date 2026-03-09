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
  History,
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
  GripVertical,
  Link,
  Tag,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UsersTab } from "@/components/settings/users-tab";
import type { TelegramStatusSnapshot } from "@/types/config";

const DEFAULT_TELEGRAM_AUTH: TelegramStatusSnapshot = {
  state: "disconnected",
  error: null,
  passwordHint: "",
  busy: false,
  sessionReady: false,
  currentCommandId: null,
  retryCount: 0,
  lastHeartbeatAt: null,
  lastConnectedAt: null,
  lastAuthAt: null,
  workerOnline: false,
};

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
  priority: number;
}

interface TweakConfig {
  name: string;
  aliases?: string[];
  lockedChannelId?: string | null;
}

type SettingsMap = Record<string, string | number | boolean | string[] | TweakConfig[]>;

function SortableChannelItem({
  ch,
  index,
  children,
  forumSection,
}: {
  ch: Channel;
  index: number;
  children: React.ReactNode;
  forumSection?: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ch.channelId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
          {index + 1}
        </span>
        {children}
      </div>
      {forumSection}
    </div>
  );
}

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
  const [telegramAuth, setTelegramAuth] =
    useState<TelegramStatusSnapshot>(DEFAULT_TELEGRAM_AUTH);
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
        if (JSON.stringify(a) !== JSON.stringify(b)) return true;
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
      const res = await fetch("/api/auth/telegram", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setTelegramAuth({
          ...DEFAULT_TELEGRAM_AUTH,
          ...data,
        });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadTelegramAuth();
    const intervalMs =
      activeTab === "integrations" ||
      activeTab === "actions" ||
      telegramAuth.state === "connecting" ||
      telegramAuth.state === "waiting_code" ||
      telegramAuth.state === "waiting_password" ||
      telegramAuth.state === "error" ||
      !telegramAuth.workerOnline
        ? 3_000
        : 10_000;

    const interval = setInterval(loadTelegramAuth, intervalMs);
    return () => clearInterval(interval);
  }, [
    activeTab,
    loadTelegramAuth,
    telegramAuth.state,
    telegramAuth.workerOnline,
  ]);

  const loadData = useCallback(async () => {
    try {
      const [settingsRes, channelsRes, meRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/channels"),
        fetch("/api/auth/me", { cache: "no-store" }),
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
        toast.success(
          data.created ? "Topic refresh queued" : "Topic refresh already queued"
        );
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = channels.findIndex((c) => c.channelId === active.id);
    const newIndex = channels.findIndex((c) => c.channelId === over.id);
    const reordered = arrayMove(channels, oldIndex, newIndex);
    setChannels(reordered);
    setSavedChannels(reordered);

    try {
      await fetch("/api/channels/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelIds: reordered.map((c) => c.channelId) }),
      });
    } catch {
      toast.error("Failed to save channel order");
      loadData();
    }
  };

  // Normalize known_tweaks: old format (string[]) → TweakConfig[]
  const knownTweaks: TweakConfig[] = useMemo(() => {
    const raw = settings.known_tweaks;
    if (!Array.isArray(raw)) return [];
    return raw.map((entry: unknown) =>
      typeof entry === "string"
        ? { name: entry, lockedChannelId: null }
        : (entry as TweakConfig)
    );
  }, [settings.known_tweaks]);

  const [newTweak, setNewTweak] = useState("");
  const [nukeOpen, setNukeOpen] = useState(false);
  const [nukeLoading, setNukeLoading] = useState(false);
  const [nukeConfirm, setNukeConfirm] = useState("");

  const updateSetting = (key: string, value: string | number | boolean | string[] | TweakConfig[]) => {
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
          if (JSON.stringify(a) !== JSON.stringify(b)) changed[key] = a;
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
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json();
      setTelegramAuth({
        ...DEFAULT_TELEGRAM_AUTH,
        ...data,
      });

      if (!data.success) {
        toast.error(data.error);
      } else {
        if (action === "connect") {
          toast.success(data.created ? "Telegram connect queued" : "Telegram connect already queued");
        } else if (action === "disconnect") {
          toast.success(data.created ? "Telegram disconnect queued" : "Telegram disconnect already queued");
        } else if (action === "reset") {
          toast.success(data.created ? "Telegram session reset queued" : "Telegram reset already queued");
        } else if (action === "code") {
          toast.success(data.created ? "Verification code queued" : "Verification code already queued");
          setAuthCode("");
        } else if (action === "password") {
          toast.success(data.created ? "2FA password queued" : "2FA password already queued");
          setAuthPassword("");
        }
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
      toast.info(`Queueing ${action}...`);
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
                <Label>Subtitle</Label>
                <Input
                  value={String(settings.source_subtitle || "")}
                  onChange={(e) =>
                    updateSetting("source_subtitle", e.target.value)
                  }
                  placeholder="e.g., iOS App Repository"
                />
              </div>
              <div className="space-y-2">
                <Label>Icon URL</Label>
                <Input
                  value={String(settings.source_icon_url || "")}
                  onChange={(e) =>
                    updateSetting("source_icon_url", e.target.value)
                  }
                  placeholder="https://example.com/icon.png"
                />
              </div>
              <div className="space-y-2">
                <Label>Tint Color</Label>
                <div className="flex gap-2">
                  <Input
                    value={String(settings.source_tint_color || "")}
                    onChange={(e) =>
                      updateSetting("source_tint_color", e.target.value)
                    }
                    placeholder="#5C7AEA"
                    className="flex-1"
                  />
                  <div
                    className="h-9 w-9 rounded-md border shrink-0"
                    style={{ backgroundColor: String(settings.source_tint_color || "#5C7AEA") }}
                  />
                </div>
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
                <Label>Previous IPA Scan Amount</Label>
                <NumberInput
                  value={Number(settings.previous_ipa_scan_amount) || 50}
                  min={1}
                  onChange={(v) => updateSetting("previous_ipa_scan_amount", v)}
                />
                <p className="text-xs text-muted-foreground">
                  Number of IPAs to find when running Scan Previous
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
              Tweak names used to distinguish apps with the same bundle ID. Add aliases so alternative names resolve to the same tweak, and lock a tweak to a specific channel.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Tweak name (e.g., Watusi)"
                value={newTweak}
                onChange={(e) => setNewTweak(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTweak.trim()) {
                    if (!knownTweaks.some((t) => t.name === newTweak.trim())) {
                      updateSetting("known_tweaks", [...knownTweaks, { name: newTweak.trim(), lockedChannelId: null }]);
                    }
                    setNewTweak("");
                  }
                }}
              />
              <Button
                onClick={() => {
                  if (!newTweak.trim()) return;
                  if (!knownTweaks.some((t) => t.name === newTweak.trim())) {
                    updateSetting("known_tweaks", [...knownTweaks, { name: newTweak.trim(), lockedChannelId: null }]);
                  }
                  setNewTweak("");
                }}
              >
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {knownTweaks.map((tweak) => {
                const lockedChannel = tweak.lockedChannelId
                  ? channels.find((c) => c.channelId === tweak.lockedChannelId)
                  : null;
                const aliases = tweak.aliases || [];

                return (
                  <div
                    key={tweak.name}
                    className="flex items-center gap-1 rounded-md border px-3 py-1 text-sm"
                  >
                    <span>{tweak.name}</span>
                    {aliases.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        ({aliases.join(", ")})
                      </span>
                    )}
                    {/* Aliases dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={`ml-0.5 flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] transition-colors ${
                            aliases.length > 0
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                          title={aliases.length > 0 ? `Aliases: ${aliases.join(", ")}` : "Add aliases"}
                        >
                          <Tag className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48" onCloseAutoFocus={(e) => e.preventDefault()}>
                        <DropdownMenuLabel>Aliases</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {aliases.map((alias) => (
                          <DropdownMenuItem
                            key={alias}
                            onClick={() => {
                              updateSetting(
                                "known_tweaks",
                                knownTweaks.map((t) =>
                                  t.name === tweak.name
                                    ? { ...t, aliases: aliases.filter((a) => a !== alias) }
                                    : t
                                )
                              );
                            }}
                          >
                            <span className="flex-1">{alias}</span>
                            <X className="h-3 w-3 text-muted-foreground" />
                          </DropdownMenuItem>
                        ))}
                        {aliases.length === 0 && (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            No aliases
                          </div>
                        )}
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                          <Input
                            placeholder="Add alias..."
                            className="h-7 text-xs"
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter") {
                                const val = e.currentTarget.value.trim();
                                if (val && !aliases.includes(val)) {
                                  updateSetting(
                                    "known_tweaks",
                                    knownTweaks.map((t) =>
                                      t.name === tweak.name
                                        ? { ...t, aliases: [...aliases, val] }
                                        : t
                                    )
                                  );
                                  e.currentTarget.value = "";
                                }
                              }
                            }}
                          />
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {/* Channel lock dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={`ml-0.5 flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] transition-colors ${
                            lockedChannel
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                          title={lockedChannel ? `Locked to ${lockedChannel.channelName || lockedChannel.channelId}` : "Lock to channel"}
                        >
                          <Link className="h-3 w-3" />
                          {lockedChannel && (
                            <span className="max-w-[80px] truncate">
                              {lockedChannel.channelName || lockedChannel.channelId}
                            </span>
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem
                          onClick={() => {
                            updateSetting(
                              "known_tweaks",
                              knownTweaks.map((t) =>
                                t.name === tweak.name ? { ...t, lockedChannelId: null } : t
                              )
                            );
                          }}
                        >
                          All channels
                        </DropdownMenuItem>
                        {channels.map((ch) => (
                          <DropdownMenuItem
                            key={ch.channelId}
                            onClick={() => {
                              updateSetting(
                                "known_tweaks",
                                knownTweaks.map((t) =>
                                  t.name === tweak.name
                                    ? { ...t, lockedChannelId: ch.channelId }
                                    : t
                                )
                              );
                            }}
                          >
                            {ch.channelName || ch.channelId}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <button
                      className="ml-1 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        updateSetting("known_tweaks", knownTweaks.filter((t) => t.name !== tweak.name));
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
              {knownTweaks.length === 0 && (
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
                  {telegramAuth.workerOnline && telegramAuth.state === "ready" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : !telegramAuth.workerOnline ? (
                    <AlertCircle className="h-4 w-4 text-red-500" />
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
                    {!telegramAuth.workerOnline
                      ? "Worker offline"
                      : telegramAuth.state === "ready"
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
                <div className="flex gap-2">
                  {telegramAuth.workerOnline && telegramAuth.state === "ready" ? (
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
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={authLoading}
                    onClick={() => telegramAuthAction("reset")}
                  >
                    <Bomb className="mr-1 h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {!telegramAuth.workerOnline
                  ? "The Telegram worker heartbeat is stale. Start or restart the worker to process queued commands."
                  : telegramAuth.busy
                    ? `Worker is processing Telegram command #${telegramAuth.currentCommandId}.`
                    : telegramAuth.sessionReady
                      ? "A reusable Telegram session is available in worker storage."
                      : "No active Telegram session is available yet."}
              </p>
              {telegramAuth.error && (
                <p className="text-xs text-red-500">{telegramAuth.error}</p>
              )}
              <Dialog
                open={telegramAuth.state === "waiting_code" || telegramAuth.state === "waiting_password"}
                onOpenChange={() => {}}
              >
                <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
                  <DialogHeader>
                    <DialogTitle>
                      {telegramAuth.state === "waiting_code"
                        ? "Telegram Verification Code"
                        : "Two-Factor Authentication"}
                    </DialogTitle>
                    <DialogDescription>
                      {telegramAuth.state === "waiting_code"
                        ? "A verification code has been sent to your Telegram account. Please enter it below."
                        : "Your account has two-factor authentication enabled. Please enter your password."}
                    </DialogDescription>
                  </DialogHeader>
                  {telegramAuth.state === "waiting_code" && (
                    <div className="space-y-4">
                      <Input
                        placeholder="Enter verification code"
                        value={authCode}
                        onChange={(e) => setAuthCode(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          authCode &&
                          telegramAuthAction("code", { code: authCode })
                        }
                        autoFocus
                      />
                      {telegramAuth.error && (
                        <p className="text-xs text-red-500">{telegramAuth.error}</p>
                      )}
                    </div>
                  )}
                  {telegramAuth.state === "waiting_password" && (
                    <div className="space-y-4">
                      {telegramAuth.passwordHint && (
                        <p className="text-sm text-muted-foreground">
                          Hint: {telegramAuth.passwordHint}
                        </p>
                      )}
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
                        autoFocus
                      />
                      {telegramAuth.error && (
                        <p className="text-xs text-red-500">{telegramAuth.error}</p>
                      )}
                    </div>
                  )}
                  <DialogFooter>
                    <Button
                      disabled={
                        authLoading ||
                        (telegramAuth.state === "waiting_code" ? !authCode : !authPassword)
                      }
                      onClick={() =>
                        telegramAuth.state === "waiting_code"
                          ? telegramAuthAction("code", { code: authCode })
                          : telegramAuthAction("password", { password: authPassword })
                      }
                    >
                      {authLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {telegramAuth.state === "waiting_code" ? "Verify" : "Submit"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
            <p className="text-sm text-muted-foreground">
              Drag channels to set scan priority. Higher channels are scanned first and preferred when two IPAs share the same version.
            </p>
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={channels.map((c) => c.channelId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {channels.map((ch, index) => {
                    const enabledCount = ch.forumTopics?.filter((t) => t.enabled).length ?? 0;
                    const totalTopics = ch.forumTopics?.length ?? 0;
                    const isExpanded = expandedForums.has(ch.channelId);
                    const isRefreshing = refreshingTopics.has(ch.channelId);

                    return (
                      <SortableChannelItem
                        key={ch.channelId}
                        ch={ch}
                        index={index}
                        forumSection={ch.isForum && totalTopics > 0 ? (
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
                        ) : undefined}
                      >
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
                      </SortableChannelItem>
                    );
                  })}
                  {channels.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No channels configured
                    </p>
                  )}
                </div>
              </SortableContext>
            </DndContext>
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
                onClick={() => runAction("scan-previous")}
              >
                <History className="mr-2 h-4 w-4" />
                Scan Previous
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
                This will permanently delete <strong>all queue entries</strong>, <strong>all downloaded IPAs</strong> from the database, <strong>all GitHub releases and tags</strong>, and <strong>all JSON files</strong> from the repository. Channel scan progress will be reset. This action cannot be undone.
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
