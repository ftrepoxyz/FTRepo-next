"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Moon, Sun } from "lucide-react";

export function Header() {
  const [status, setStatus] = useState<"healthy" | "unhealthy" | "loading">(
    "loading"
  );
  const [dark, setDark] = useState(false);

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
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
  }, []);

  const toggleDark = () => {
    document.documentElement.classList.toggle("dark");
    setDark(!dark);
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-6">
      <div className="flex items-center gap-4">
        <Badge
          variant={
            status === "healthy"
              ? "default"
              : status === "unhealthy"
                ? "destructive"
                : "secondary"
          }
          className="text-xs"
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
      </div>
    </header>
  );
}
