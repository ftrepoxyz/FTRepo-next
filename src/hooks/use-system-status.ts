"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

interface SystemStatusState {
  enabled: boolean;
  loading: boolean;
  toggle: () => void;
}

export const SystemStatusContext = createContext<SystemStatusState>({
  enabled: true,
  loading: false,
  toggle: () => {},
});

export function useSystemStatus() {
  return useContext(SystemStatusContext);
}

export function useSystemStatusState(): SystemStatusState {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/system");
      const data = await res.json();
      if (data.success) setEnabled(data.enabled);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const toggle = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const data = await res.json();
      if (data.success) {
        setEnabled(data.enabled);
        toast.success(data.enabled ? "System started" : "System stopped");
      }
    } catch {
      toast.error("Failed to toggle system");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  return { enabled, loading, toggle };
}
