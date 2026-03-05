"use client";

import { useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Like useState, but syncs the value to a URL search parameter so it
 * survives page reloads.  Uses `history.replaceState` to avoid
 * triggering Next.js navigation / re-renders.
 */
export function useUrlState(
  key: string,
  defaultValue: string = "",
): [string, (value: string) => void] {
  const searchParams = useSearchParams();
  const [value, setValue] = useState(
    () => searchParams.get(key) ?? defaultValue,
  );

  const isMount = useRef(true);

  useEffect(() => {
    if (isMount.current) {
      isMount.current = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (value === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}`,
    );
  }, [key, value, defaultValue]);

  const set = useCallback((v: string) => setValue(v), []);
  return [value, set];
}

/** Numeric variant — stores as string in the URL but exposes a number. */
export function useUrlNumberState(
  key: string,
  defaultValue: number,
): [number, (value: number) => void] {
  const [raw, setRaw] = useUrlState(key, String(defaultValue));
  const num = Number(raw) || defaultValue;
  const set = useCallback((v: number) => setRaw(String(v)), [setRaw]);
  return [num, set];
}
