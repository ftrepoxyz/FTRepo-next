"use client";

import { useState, useEffect } from "react";

interface Branding {
  source_name: string;
  source_description: string;
  source_subtitle: string;
  source_icon_url: string;
  source_tint_color: string;
  site_domain: string;
}

const DEFAULT_BRANDING: Branding = {
  source_name: "FTRepo",
  source_description: "Automated iOS IPA distribution",
  source_subtitle: "iOS App Repository",
  source_icon_url: "",
  source_tint_color: "#5C7AEA",
  site_domain: "",
};

let cachedBranding: Branding | null = null;
let fetchPromise: Promise<Branding> | null = null;

function fetchBranding(): Promise<Branding> {
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch("/api/branding")
    .then((res) => res.json())
    .then((data: Branding) => {
      cachedBranding = data;
      return data;
    })
    .catch(() => DEFAULT_BRANDING);
  return fetchPromise;
}

export function useBranding(): Branding {
  const [branding, setBranding] = useState<Branding>(
    cachedBranding ?? DEFAULT_BRANDING
  );

  useEffect(() => {
    if (cachedBranding) {
      return;
    }
    fetchBranding().then(setBranding);
  }, []);

  return branding;
}
