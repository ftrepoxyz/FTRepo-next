"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  LogIn,
  Package,
  Zap,
  Shield,
  Download,
  Settings,
  ArrowDown,
} from "lucide-react";

interface StartPageProps {
  sourceName: string;
  sourceSubtitle: string;
  baseUrl: string | null;
  tintColor: string;
}

const signers = [
  {
    name: "SideStore",
    scheme: (url: string) => `sidestore://source?url=${url}`,
    color: "#8B5CF6",
    file: "store.json",
  },
  {
    name: "AltStore Classic",
    scheme: (url: string) => `altstore-classic://source?url=${url}`,
    color: "#14B8A6",
    file: "store.json",
  },
  {
    name: "Feather",
    scheme: (url: string) => `feather://source/${url}`,
    color: "#EC4899",
    file: "feather.json",
  },
  {
    name: "StikStore",
    scheme: (url: string) => `stikstore://add-source?url=${url}`,
    color: "#2997FF",
    file: "store.json",
  },
  {
    name: "LiveContainer",
    scheme: (url: string) => `livecontainer://source?url=${url}`,
    color: "#34C759",
    file: "store.json",
  },
];

const otherFormats = [
  { name: "ESign", file: "esign.json" },
  { name: "Scarlet", file: "scarlet.json" },
];

const features = [
  {
    icon: Zap,
    title: "Automated Discovery",
    desc: "Apps are automatically discovered and processed from your configured Telegram channels.",
  },
  {
    icon: Shield,
    title: "Multi-Signer Support",
    desc: "Compatible with SideStore, AltStore, Feather, StikStore, LiveContainer, and more.",
  },
  {
    icon: Download,
    title: "One-Tap Install",
    desc: "Add this source to your favourite signer and install apps directly on your device.",
  },
];

const steps = [
  {
    num: "01",
    title: "Configure",
    desc: "Connect your Telegram channels and GitHub repository.",
  },
  {
    num: "02",
    title: "Discover",
    desc: "FTRepo scans, processes, and catalogs every IPA it finds.",
  },
  {
    num: "03",
    title: "Install",
    desc: "Add the source to your signer and browse apps on-device.",
  },
];

export function StartPage({
  sourceName,
  sourceSubtitle,
  baseUrl,
  tintColor,
}: StartPageProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const integrationsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { threshold: 0.15 }
    );
    document
      .querySelectorAll(".hp-reveal")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const copyUrl = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, []);

  const storeUrl = baseUrl ? baseUrl + "store.json" : null;

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-300 overflow-x-hidden selection:bg-white/10">
      {/* Soft ambient glow at top */}
      <div
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full blur-[140px] opacity-[0.06]"
        style={{ backgroundColor: tintColor }}
      />

      {/* ── Header ── */}
      <header className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-5">
        <span
          className="text-xs font-semibold tracking-[0.25em] uppercase text-zinc-600"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {sourceName}
        </span>
        <a
          href="/login"
          className="flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-300 transition-colors duration-200"
        >
          <LogIn className="h-3.5 w-3.5" />
          Admin
        </a>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-[88vh] px-6 hp-stagger">
        <div
          className="w-14 h-14 rounded-[14px] flex items-center justify-center mb-8 border border-zinc-800 bg-zinc-900/80"
          style={{
            borderColor: `color-mix(in srgb, ${tintColor} 25%, transparent)`,
          }}
        >
          <Package className="h-7 w-7" style={{ color: tintColor }} />
        </div>

        <h1
          className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-center text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {sourceName}
        </h1>

        <p className="mt-4 text-base sm:text-lg text-zinc-500 text-center max-w-md">
          {sourceSubtitle}
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={() =>
              integrationsRef.current?.scrollIntoView({ behavior: "smooth" })
            }
            className="px-7 py-3 rounded-full text-sm font-medium text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
            style={{ backgroundColor: tintColor }}
          >
            Add to Your App
          </button>
          <a
            href="#about"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("about")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            className="text-sm text-zinc-600 hover:text-zinc-300 transition-colors duration-200"
          >
            Learn more
          </a>
        </div>

        <div className="absolute bottom-10 text-zinc-700 animate-bounce">
          <ArrowDown className="h-4 w-4" />
        </div>
      </section>

      {/* ── Separator ── */}
      <div className="mx-auto w-12 h-px bg-zinc-800" />

      {/* ── About ── */}
      <section id="about" className="relative z-10 py-24 sm:py-32 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="hp-reveal">
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-zinc-600 mb-3">
              About
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              What is {sourceName}?
            </h2>
            <p className="text-zinc-500 leading-relaxed max-w-xl">
              An automated iOS app repository that discovers apps from Telegram
              channels, processes them, and generates feeds compatible with every
              major signer app — so you can browse and install with a single tap.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="hp-reveal rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-6 hover:border-zinc-700 hover:bg-zinc-900/70 transition-all duration-300"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <f.icon className="h-5 w-5 text-zinc-500 mb-4" />
                <h3 className="text-sm font-semibold text-white mb-1.5">
                  {f.title}
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="relative z-10 py-24 sm:py-32 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="hp-reveal">
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-zinc-600 mb-3">
              How it works
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-12">
              Three steps to get started
            </h2>
          </div>

          <div className="space-y-8">
            {steps.map((step, i) => (
              <div
                key={step.num}
                className="hp-reveal flex items-start gap-6"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <span
                  className="text-xs font-mono font-bold shrink-0 mt-0.5"
                  style={{ color: tintColor }}
                >
                  {step.num}
                </span>
                <div className="border-b border-zinc-800/60 pb-8 flex-1">
                  <h3 className="text-base font-semibold text-white mb-1">
                    {step.title}
                  </h3>
                  <p className="text-sm text-zinc-500">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Separator ── */}
      <div className="mx-auto w-12 h-px bg-zinc-800" />

      {/* ── Integrations ── */}
      <section
        ref={integrationsRef}
        className="relative z-10 py-24 sm:py-32 px-6"
      >
        <div className="max-w-md mx-auto">
          <div className="hp-reveal text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-zinc-600 mb-3">
              Get started
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              Add to Your App
            </h2>
            <p className="text-sm text-zinc-500">
              Choose your preferred signer
            </p>
          </div>

          {baseUrl ? (
            <>
              {/* Source URL */}
              <div className="hp-reveal flex items-center gap-3 rounded-lg border border-zinc-800/60 bg-zinc-900/50 px-4 py-3 mb-8">
                <code className="flex-1 truncate text-xs text-zinc-500 font-mono">
                  {storeUrl}
                </code>
                <button
                  onClick={() => storeUrl && copyUrl(storeUrl, "source")}
                  className="shrink-0 p-1.5 rounded text-zinc-600 hover:text-zinc-300 transition-colors duration-200"
                  title="Copy source URL"
                >
                  {copiedId === "source" ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Signer buttons */}
              <div className="space-y-2.5 mb-8">
                {signers.map((signer, i) => {
                  const url = baseUrl + signer.file;
                  return (
                    <a
                      key={signer.name}
                      href={signer.scheme(url)}
                      className="hp-reveal group flex items-center gap-4 rounded-xl border border-zinc-800/50 bg-zinc-900/30 px-5 py-3.5 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all duration-200"
                      style={{ transitionDelay: `${i * 60}ms` }}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: signer.color }}
                      >
                        {signer.name.charAt(0)}
                      </div>
                      <span className="flex-1 text-sm font-medium text-zinc-200">
                        Open in {signer.name}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    </a>
                  );
                })}
              </div>

              {/* Other formats */}
              <div className="hp-reveal">
                <p className="text-[11px] text-center uppercase tracking-[0.2em] text-zinc-700 mb-3">
                  Other formats
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {otherFormats.map((fmt) => {
                    const url = baseUrl + fmt.file;
                    return (
                      <button
                        key={fmt.name}
                        onClick={() => copyUrl(url, fmt.name)}
                        className="flex items-center justify-center gap-2 rounded-lg border border-zinc-800/50 bg-zinc-900/30 px-4 py-2.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all duration-200"
                      >
                        {copiedId === fmt.name ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            {fmt.name}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="hp-reveal text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl border border-zinc-800 bg-zinc-900/50 mb-2">
                <Settings className="h-6 w-6 text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-500">
                Repository source not configured yet.
              </p>
              <a
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-medium transition-colors duration-200 hover:brightness-125"
                style={{ color: tintColor }}
              >
                <LogIn className="h-4 w-4" />
                Log in to configure
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 py-10 text-center">
        <div className="mx-auto w-8 h-px bg-zinc-800/60 mb-6" />
        <p className="text-[11px] text-zinc-700">Powered by {sourceName}</p>
      </footer>
    </div>
  );
}
