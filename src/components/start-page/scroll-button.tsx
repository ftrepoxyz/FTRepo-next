"use client";

import type { CSSProperties, ReactNode } from "react";

interface ScrollButtonProps {
  targetId: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function ScrollButton({
  targetId,
  className,
  style,
  children,
}: ScrollButtonProps) {
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() =>
        document.getElementById(targetId)?.scrollIntoView({
          behavior: "smooth",
        })
      }
    >
      {children}
    </button>
  );
}
