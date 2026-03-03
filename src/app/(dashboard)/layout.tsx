"use client";

import { Sidebar, MobileSidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import {
  MobileSidebarContext,
  useMobileSidebarState,
} from "@/hooks/use-mobile-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const mobileSidebar = useMobileSidebarState();

  return (
    <MobileSidebarContext.Provider value={mobileSidebar}>
      <div className="flex h-screen overflow-hidden">
        <div className="hidden md:flex">
          <Sidebar />
        </div>
        <MobileSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </MobileSidebarContext.Provider>
  );
}
