"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BarChart3,
  Database,
  Package,
  ListOrdered,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Power,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMobileSidebar } from "@/hooks/use-mobile-sidebar";
import { useBranding } from "@/hooks/use-branding";
import { useSystemStatus } from "@/hooks/use-system-status";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/metrics", label: "Metrics", icon: BarChart3 },
  { href: "/database", label: "Database", icon: Database },
  { href: "/library", label: "Library", icon: Package },
  { href: "/queue", label: "Queue", icon: ListOrdered },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SystemStatus({
  collapsed = false,
  enabled,
  loading,
  onToggle,
}: {
  collapsed?: boolean;
  enabled: boolean;
  loading: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
        "hover:bg-sidebar-accent/50",
        collapsed ? "justify-center" : "",
        loading && "opacity-50 cursor-not-allowed"
      )}
      title={enabled ? "Stop system" : "Start system"}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {enabled && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            enabled ? "bg-emerald-500" : "bg-red-500"
          )}
        />
      </span>
      {!collapsed && (
        <>
          <span className="text-sidebar-foreground/70">
            {enabled ? "System Online" : "System Offline"}
          </span>
          <Power className={cn(
            "ml-auto h-3.5 w-3.5 shrink-0",
            enabled ? "text-emerald-500" : "text-red-500"
          )} />
        </>
      )}
    </button>
  );
}

function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 p-2">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { source_name } = useBranding();
  const { enabled, loading, toggle } = useSystemStatus();

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-lg font-bold text-sidebar-foreground">
              {source_name}
            </span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <SidebarNav collapsed={collapsed} />

      <div className="border-t border-border p-2">
        <SystemStatus
          collapsed={collapsed}
          enabled={enabled}
          loading={loading}
          onToggle={toggle}
        />
      </div>
    </aside>
  );
}

export function MobileSidebar() {
  const { open, setOpen } = useMobileSidebar();
  const { source_name } = useBranding();
  const { enabled, loading, toggle } = useSystemStatus();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" showCloseButton={false} className="w-56 bg-sidebar p-0 text-sidebar-foreground">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex h-14 items-center border-b border-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <span className="text-lg font-bold text-sidebar-foreground">
              {source_name}
            </span>
          </Link>
        </div>

        <SidebarNav onNavigate={() => setOpen(false)} />

        <div className="border-t border-border p-2">
          <SystemStatus
            enabled={enabled}
            loading={loading}
            onToggle={toggle}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
