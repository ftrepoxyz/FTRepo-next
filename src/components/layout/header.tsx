"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Moon, Sun, LogOut, Menu } from "lucide-react";
import { useMobileSidebar } from "@/hooks/use-mobile-sidebar";
import { useSystemStatus } from "@/hooks/use-system-status";
import type { TelegramStatusSnapshot } from "@/types/config";

const DEFAULT_TELEGRAM_STATUS: TelegramStatusSnapshot = {
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

interface HeaderProps {
  username: string;
}

export function Header({ username }: HeaderProps) {
  const { setOpen } = useMobileSidebar();
  const { enabled: systemEnabled } = useSystemStatus();
  const [dark, setDark] = useState(() => {
    if (typeof document === "undefined") {
      return false;
    }
    return document.documentElement.classList.contains("dark");
  });
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatusSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTelegramStatus = async () => {
      try {
        const res = await fetch("/api/auth/telegram", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data.success) {
          setTelegramStatus({
            ...DEFAULT_TELEGRAM_STATUS,
            ...data,
          });
        }
      } catch {
        // ignore — user may not be authed yet
      }
    };

    void loadTelegramStatus();
    const interval = setInterval(() => {
      void loadTelegramStatus();
    }, 10_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const toggleDark = () => {
    document.documentElement.classList.toggle("dark");
    setDark(!dark);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      cache: "no-store",
    });
    window.location.href = "/login";
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-3 md:px-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        {telegramStatus && (!telegramStatus.workerOnline || telegramStatus.state !== "ready") ? (
          <Badge
            variant="outline"
            className={
              telegramStatus.workerOnline
                ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs"
                : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs"
            }
          >
            <span className="relative mr-1.5 flex h-2 w-2">
              {telegramStatus.workerOnline &&
                telegramStatus.state === "connecting" && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  telegramStatus.workerOnline ? "bg-amber-500" : "bg-red-500"
                }`}
              />
            </span>
            {!telegramStatus.workerOnline
              ? "Telegram Worker Offline"
              : telegramStatus.state === "connecting"
                ? "Telegram Connecting"
                : telegramStatus.state === "waiting_code"
                  ? "Telegram Awaiting Code"
                  : telegramStatus.state === "waiting_password"
                    ? "Telegram Awaiting 2FA"
                    : telegramStatus.state === "error"
                      ? "Telegram Error"
                      : "Telegram Disconnected"}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className={
              systemEnabled
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs"
                : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs"
            }
          >
            <span className="relative mr-1.5 flex h-2 w-2">
              {systemEnabled && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${systemEnabled ? "bg-emerald-500" : "bg-red-500"}`} />
            </span>
            {systemEnabled ? "System Online" : "System Offline"}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleDark}>
          {dark ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
        <span className="hidden text-sm text-muted-foreground sm:inline">{username}</span>
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
