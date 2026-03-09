"use client";

import { useEffect, useState, type ReactNode } from "react";

interface CopyButtonProps {
  text: string;
  title: string;
  className?: string;
  idleContent: ReactNode;
  copiedContent: ReactNode;
}

export function CopyButton({
  text,
  title,
  className,
  idleContent,
  copiedContent,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  return (
    <button
      type="button"
      title={title}
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? copiedContent : idleContent}
    </button>
  );
}
