"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Moon, Sun, LogOut, Menu } from "lucide-react";
import { useMobileSidebar } from "@/hooks/use-mobile-sidebar";

export function Header() {
  const { setOpen } = useMobileSidebar();
  const [status, setStatus] = useState<"healthy" | "unhealthy" | "loading">(
    "loading"
  );
  const [dark, setDark] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      setStatus(res.ok ? "healthy" : "unhealthy");
    } catch {
      setStatus("unhealthy");
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

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
          variant={
            status === "healthy"
              ? "default"
              : status === "unhealthy"
                ? "destructive"
                : "secondary"
          }
          className={
            status === "healthy"
              ? "bg-green-600 text-white text-xs"
              : "text-xs"
          }
        >
          {status === "healthy"
            ? "System Online"
            : status === "unhealthy"
              ? "System Offline"
              : "Checking..."}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={checkHealth}>
          <RefreshCw className="h-4 w-4" />
        </Button>
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
