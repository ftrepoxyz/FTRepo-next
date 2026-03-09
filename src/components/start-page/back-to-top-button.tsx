"use client";

import { ArrowUp } from "lucide-react";

interface BackToTopButtonProps {
  className?: string;
}

export function BackToTopButton({ className }: BackToTopButtonProps) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <ArrowUp className="h-3 w-3" />
      Back to top
    </button>
  );
}
