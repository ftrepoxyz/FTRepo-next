"use client";

import { Sidebar, MobileSidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import {
  MobileSidebarContext,
  useMobileSidebarState,
} from "@/hooks/use-mobile-sidebar";
import {
  SystemStatusContext,
  useSystemStatusState,
} from "@/hooks/use-system-status";

interface DashboardShellProps {
  children: React.ReactNode;
  username: string;
}

export function DashboardShell({
  children,
  username,
}: DashboardShellProps) {
  const mobileSidebar = useMobileSidebarState();
  const systemStatus = useSystemStatusState();

  return (
    <SystemStatusContext.Provider value={systemStatus}>
      <MobileSidebarContext.Provider value={mobileSidebar}>
        <div className="flex h-screen overflow-hidden">
          <div className="hidden md:flex">
            <Sidebar />
          </div>
          <MobileSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header username={username} />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </div>
      </MobileSidebarContext.Provider>
    </SystemStatusContext.Provider>
  );
}
