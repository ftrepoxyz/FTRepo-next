"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Moon, Sun, LogOut, Menu } from "lucide-react";
import { useMobileSidebar } from "@/hooks/use-mobile-sidebar";
import { useSystemStatus } from "@/hooks/use-system-status";

export function Header() {
  const { setOpen } = useMobileSidebar();
  const { enabled: systemEnabled } = useSystemStatus();
  const [dark, setDark] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.success) setUsername(d.user.username); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
  }, []);

  const toggleDark = () => {
    document.documentElement.classList.toggle("dark");
    setDark(!dark);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
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
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleDark}>
          {dark ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
        {username && (
          <>
            <span className="hidden text-sm text-muted-foreground sm:inline">{username}</span>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out">
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
