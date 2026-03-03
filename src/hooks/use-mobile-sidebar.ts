"use client";

import { createContext, useContext, useState } from "react";

interface MobileSidebarState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const MobileSidebarContext = createContext<MobileSidebarState>({
  open: false,
  setOpen: () => {},
});

export function useMobileSidebar() {
  return useContext(MobileSidebarContext);
}

export function useMobileSidebarState(): MobileSidebarState {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
