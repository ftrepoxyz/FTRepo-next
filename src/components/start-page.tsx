"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  LogIn,
  Package,
  Settings,
  ArrowDown,
  ArrowUp,
  Ban,
  Crown,
  Infinity,
  Lock,
  Globe,
  Github,
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

const perks = [
  {
    icon: Ban,
    title: "No Ads",
    desc: "Every app is completely ad-free. No banners, no pop-ups, no interruptions.",
  },
  {
    icon: Crown,
    title: "Premium Unlocked",
    desc: "All paid features and subscriptions are fully unlocked out of the box.",
  },
  {
    icon: Infinity,
    title: "No Limits",
    desc: "Usage restrictions, upload caps, and artificial limits are removed.",
  },
  {
    icon: Lock,
    title: "Revoke Protection",
    desc: "Apps are signed to minimize revokes so they keep working.",
  },
];


const carouselApps = [
  { name: "YouTube", icon: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/d1/3f/f2/d13ff2d8-57a8-399e-00f0-7be52c40af6a/logo_youtube_2024_q4_color-0-0-1x_U007emarketing-0-0-0-7-0-0-0-85-220.png/128x128bb.jpg" },
  { name: "Spotify", icon: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/a7/6f/ff/a76fff08-4ee7-a85e-fa75-160149936ff8/AppIcon-0-0-1x_U007epad-0-1-0-0-sRGB-85-220.png/128x128bb.jpg" },
  { name: "Instagram", icon: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/44/e7/3e/44e73e4c-1819-1c3b-6032-8398e74507e5/Prod-0-0-1x_U007epad-0-1-0-sRGB-85-220.png/128x128bb.jpg" },
  { name: "Snapchat", icon: "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/6e/28/84/6e2884c3-efb0-0ba0-c6b0-e3ea0c6dc191/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/128x128bb.jpg" },
  { name: "TikTok", icon: "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/7e/7c/c0/7e7cc0ef-43f4-ee30-70da-a70aab7fa814/AppIcon_TikTok-0-0-1x_U007epad-0-1-0-0-85-220.png/128x128bb.jpg" },
  { name: "X", icon: "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/14/b4/3a/14b43a76-a196-e5b9-6013-99169daf9b2e/ProductionAppIcon-0-0-1x_U007emarketing-0-8-0-0-0-85-220.png/128x128bb.jpg" },
  { name: "WhatsApp", icon: "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/13/04/4b/13044bd1-11d0-ea3f-6eab-82d4a942092c/AppIcon-0-0-1x_U007epad-0-0-0-1-0-0-sRGB-0-85-220.png/128x128bb.jpg" },
  { name: "Duolingo", icon: "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/ac/be/e0/acbee052-fabb-4abd-59ee-bc17bbd492cc/AppIcon-0-0-1x_U007epad-0-1-85-220.png/128x128bb.jpg" },
  { name: "Facebook", icon: "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/e7/dd/ea/e7ddeaa1-8a5f-afe4-72e3-fae43b514c3c/Icon-Production-0-0-1x_U007epad-0-1-0-85-220.png/128x128bb.jpg" },
  { name: "Reddit", icon: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/81/8d/53/818d5383-67d0-2fad-9be3-10d8f41035a4/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/128x128bb.jpg" },
  { name: "Twitch", icon: "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/4b/e0/48/4be04802-10c9-ce75-c113-ebed876dcd4a/TwitchAppIcon-0-0-1x_U007epad-0-1-0-0-0-0-85-220.png/128x128bb.jpg" },
  { name: "Discord", icon: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/35/71/22/357122bd-547c-de26-b341-d5cdfe6e3e65/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/128x128bb.jpg" },
  { name: "Telegram", icon: "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/36/29/76/3629760f-1cb3-a478-07a5-1f5539855e1d/Telegram-0-0-1x_U007epad-0-1-0-sRGB-85-220.png/128x128bb.jpg" },
];

function useCarouselDrag() {
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef({
    active: false,
    startX: 0,
    animStartTime: 0,
    animation: null as Animation | null,
    pixelsPerMs: 0,
    direction: -1,
    decayRaf: 0,
    history: [] as { x: number; t: number }[],
  });

  const begin = useCallback((clientX: number) => {
    const track = containerRef.current?.querySelector(
      ".hp-carousel-track"
    ) as HTMLElement | null;
    if (!track) return;
    const anims = track.getAnimations();
    if (anims.length === 0) return;
    const anim = anims[0];

    cancelAnimationFrame(drag.current.decayRaf);
    anim.pause();

    const trackWidth = track.scrollWidth / 2;
    const isReverse = track.classList.contains("hp-carousel-right");

    drag.current = {
      active: true,
      startX: clientX,
      animStartTime: (anim.currentTime as number) || 0,
      animation: anim,
      pixelsPerMs: trackWidth / 40000,
      direction: isReverse ? 1 : -1,
      decayRaf: 0,
      history: [{ x: clientX, t: Date.now() }],
    };

    containerRef.current?.classList.add("is-dragging");
  }, []);

  const move = useCallback((clientX: number) => {
    if (!drag.current.active || !drag.current.animation) return;

    const now = Date.now();
    drag.current.history.push({ x: clientX, t: now });
    // Keep last 100ms of movement
    while (
      drag.current.history.length > 1 &&
      now - drag.current.history[0].t > 100
    ) {
      drag.current.history.shift();
    }

    const dx = clientX - drag.current.startX;
    const timeOffset = dx / drag.current.pixelsPerMs;
    drag.current.animation.currentTime =
      drag.current.animStartTime + drag.current.direction * timeOffset;
  }, []);

  const end = useCallback(() => {
    if (!drag.current.active || !drag.current.animation) return;
    drag.current.active = false;

    const anim = drag.current.animation;
    const dir = drag.current.direction;
    const pxPerMs = drag.current.pixelsPerMs;

    containerRef.current?.classList.remove("is-dragging");

    // Compute velocity from the last 100ms of pointer history
    const hist = drag.current.history;
    let velocity = 0;
    if (hist.length >= 2) {
      const first = hist[0];
      const last = hist[hist.length - 1];
      const dt = last.t - first.t;
      if (dt > 0) velocity = (last.x - first.x) / dt;
    }

    // Convert fling velocity → animation-time rate
    let rate = 1 + (dir * velocity * 0.2) / pxPerMs;
    rate = Math.max(-4, Math.min(8, rate));

    // No meaningful fling → just resume normally
    if (Math.abs(rate - 1) < 0.15) {
      anim.playbackRate = 1;
      anim.play();
      return;
    }

    // Manually advance currentTime each frame (avoids negative-playbackRate crash).
    // Decay toward 1 (normal scroll speed) so fling carries then settles.
    let lastFrame = performance.now();
    const applyMomentum = (now: number) => {
      const dt = now - lastFrame;
      lastFrame = now;

      const cur = (anim.currentTime as number) || 0;
      anim.currentTime = cur + rate * dt;

      // Friction: decay toward normal speed (1.0)
      const diff = rate - 1;
      if (Math.abs(diff) < 0.05) {
        anim.playbackRate = 1;
        anim.play();
        return;
      }
      rate = 1 + diff * 0.97;
      drag.current.decayRaf = requestAnimationFrame(applyMomentum);
    };
    drag.current.decayRaf = requestAnimationFrame(applyMomentum);
  }, []);

  return {
    containerRef,
    onMouseDown: useCallback(
      (e: React.MouseEvent) => begin(e.clientX),
      [begin]
    ),
    onMouseMove: useCallback(
      (e: React.MouseEvent) => move(e.clientX),
      [move]
    ),
    onMouseUp: useCallback(() => end(), [end]),
    onMouseLeave: useCallback(() => end(), [end]),
    onTouchStart: useCallback(
      (e: React.TouchEvent) => begin(e.touches[0].clientX),
      [begin]
    ),
    onTouchMove: useCallback(
      (e: React.TouchEvent) => {
        if (drag.current.active) e.preventDefault();
        move(e.touches[0].clientX);
      },
      [move]
    ),
    onTouchEnd: useCallback(() => end(), [end]),
  };
}

const signerIcons: Record<string, React.ReactNode> = {
  SideStore: (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="36" height="36" rx="8" fill="#8B5CF6" />
      <path d="M18 8C14 8 11 11 11 14c0 2 1.5 3.5 3 4.5 1.5 1 2.5 1.8 2.5 3.5 0 1.5-1 2.5-2.5 2.5s-2.5-1-2.5-2.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M18 28c4 0 7-3 7-6 0-2-1.5-3.5-3-4.5-1.5-1-2.5-1.8-2.5-3.5 0-1.5 1-2.5 2.5-2.5s2.5 1 2.5 2.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  ),
  "AltStore Classic": (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="36" height="36" rx="8" fill="#14B8A6" />
      <path d="M18 9L26 18L18 27L10 18L18 9Z" stroke="white" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
      <path d="M18 14L22 18L18 22L14 18L18 14Z" fill="white" fillOpacity="0.3" />
    </svg>
  ),
  Feather: (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="36" height="36" rx="8" fill="#EC4899" />
      <path d="M12 28L14 20C14 20 15 14 18 11C21 8 25 8 25 8C25 8 25 12 22 15C19 18 13 19 13 19L12 28Z" fill="white" fillOpacity="0.9" />
      <path d="M14 20L22 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  StikStore: (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="36" height="36" rx="8" fill="#2997FF" />
      <rect x="10" y="12" width="16" height="14" rx="2" stroke="white" strokeWidth="2.5" fill="none" />
      <path d="M14 12V10C14 8.9 14.9 8 16 8H20C21.1 8 22 8.9 22 10V12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  LiveContainer: (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="36" height="36" rx="8" fill="#34C759" />
      <path d="M14 10L26 18L14 26V10Z" fill="white" fillOpacity="0.9" />
    </svg>
  ),
};

export function StartPage({
  sourceName,
  sourceSubtitle,
  baseUrl,
  tintColor,
}: StartPageProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [carouselReady, setCarouselReady] = useState(false);
  const integrationsRef = useRef<HTMLElement>(null);
  const row1Drag = useCarouselDrag();
  const row2Drag = useCarouselDrag();

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

  useEffect(() => {
    const timer = setTimeout(() => setCarouselReady(true), 1500);
    return () => clearTimeout(timer);
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

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const storeUrl = baseUrl ? baseUrl + "store.json" : null;
  const doubledApps = [...carouselApps, ...carouselApps];

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-300 overflow-x-hidden selection:bg-white/10">
      {/* Soft ambient glow at top */}
      <div
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full blur-[140px] opacity-[0.06]"
        style={{ backgroundColor: tintColor }}
      />

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-zinc-950/70 border-b border-zinc-800/40 flex items-center justify-between px-6 lg:px-12 py-5">
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
          className="hp-float w-14 h-14 rounded-[14px] flex items-center justify-center mb-8 border border-zinc-800 bg-zinc-900/80"
          style={{
            borderColor: `color-mix(in srgb, ${tintColor} 25%, transparent)`,
          }}
        >
          <Package className="h-7 w-7" style={{ color: tintColor }} />
        </div>

        {/* Pill badge */}
        <div
          className="flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6 text-xs font-medium"
          style={{
            borderColor: `color-mix(in srgb, ${tintColor} 25%, transparent)`,
            color: tintColor,
            backgroundColor: `color-mix(in srgb, ${tintColor} 8%, transparent)`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: tintColor }}
          />
          Automated iOS Repository
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
            className="px-8 py-3.5 rounded-full text-sm font-medium text-white transition-all duration-200 hover:brightness-110 hover:scale-105 active:scale-[0.98]"
            style={{
              backgroundColor: tintColor,
              boxShadow: `0 0 24px color-mix(in srgb, ${tintColor} 35%, transparent)`,
            }}
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

      {/* ── Apps Carousel ── */}
      <section className="relative z-10 py-16 px-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div
            className="hp-carousel"
            ref={row1Drag.containerRef}
            onMouseDown={row1Drag.onMouseDown}
            onMouseMove={row1Drag.onMouseMove}
            onMouseUp={row1Drag.onMouseUp}
            onMouseLeave={row1Drag.onMouseLeave}
            onTouchStart={row1Drag.onTouchStart}
            onTouchMove={row1Drag.onTouchMove}
            onTouchEnd={row1Drag.onTouchEnd}
          >
            <div
              className={`hp-carousel-track${carouselReady ? " hp-carousel-left" : ""}`}
            >
              {doubledApps.map((app, i) => (
                <div
                  key={`l-${app.name}-${i}`}
                  className={`hp-carousel-item${!carouselReady ? " hp-entering" : ""}`}
                  data-app={app.name}
                  style={
                    !carouselReady
                      ? { animationDelay: `${Math.min(i, 12) * 60}ms` }
                      : undefined
                  }
                >
                  <img
                    src={app.icon}
                    alt={app.name}
                    width={64}
                    height={64}
                    loading="lazy"
                    draggable={false}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
          <div
            className="hp-carousel"
            ref={row2Drag.containerRef}
            onMouseDown={row2Drag.onMouseDown}
            onMouseMove={row2Drag.onMouseMove}
            onMouseUp={row2Drag.onMouseUp}
            onMouseLeave={row2Drag.onMouseLeave}
            onTouchStart={row2Drag.onTouchStart}
            onTouchMove={row2Drag.onTouchMove}
            onTouchEnd={row2Drag.onTouchEnd}
          >
            <div
              className={`hp-carousel-track${carouselReady ? " hp-carousel-right" : ""}`}
            >
              {[...doubledApps].reverse().map((app, i) => (
                <div
                  key={`r-${app.name}-${i}`}
                  className={`hp-carousel-item${!carouselReady ? " hp-entering" : ""}`}
                  data-app={app.name}
                  style={
                    !carouselReady
                      ? { animationDelay: `${Math.min(i, 12) * 60}ms` }
                      : undefined
                  }
                >
                  <img
                    src={app.icon}
                    alt={app.name}
                    width={64}
                    height={64}
                    loading="lazy"
                    draggable={false}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
          <p className="text-center text-[11px] uppercase tracking-[0.2em] text-zinc-600 pt-2">
            Popular moddable apps
          </p>
        </div>
      </section>

      {/* ── Perks ── */}
      <section className="relative z-10 pt-8 pb-20 sm:pb-28 px-6">
        <div className="max-w-md sm:max-w-3xl mx-auto">
          <div className="hp-reveal text-center mb-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-zinc-600 mb-3">
              What you get
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Every app, fully loaded
            </h2>
          </div>

          <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-4 sm:gap-4">
            {perks.map((perk, i) => (
              <div
                key={perk.title}
                className="hp-reveal group flex items-center gap-4 sm:flex-col sm:text-center rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3.5 sm:p-5 hover:border-zinc-700 hover:bg-zinc-900/70 transition-all duration-300"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div
                  className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg shrink-0 sm:mb-3 border border-zinc-800 bg-zinc-900/80"
                  style={{
                    borderColor: `color-mix(in srgb, ${tintColor} 20%, transparent)`,
                  }}
                >
                  <perk.icon
                    className="h-4 w-4 sm:h-5 sm:w-5"
                    style={{ color: tintColor }}
                  />
                </div>
                <div className="sm:contents">
                  <h3 className="text-sm font-semibold text-white sm:mb-1">
                    {perk.title}
                  </h3>
                  <p className="hidden sm:block text-xs text-zinc-500 leading-relaxed">
                    {perk.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

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
              An open-source iOS app repository that automatically discovers
              tweaked and modded apps from Telegram, processes them, and
              generates feeds for every major signer — so you can browse and
              install with a single tap.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              className="hp-reveal hp-shiny-card group rounded-xl p-6 transition-all duration-300"
              style={{
                border: `1px solid color-mix(in srgb, ${tintColor} 30%, transparent)`,
                background: `linear-gradient(135deg, color-mix(in srgb, ${tintColor} 10%, rgb(24 24 27)) 0%, rgb(24 24 27 / 0.9) 100%)`,
                boxShadow: `0 0 40px color-mix(in srgb, ${tintColor} 18%, transparent), 0 0 80px color-mix(in srgb, ${tintColor} 6%, transparent)`,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Globe
                  className="h-5 w-5"
                  style={{ color: tintColor }}
                />
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    color: tintColor,
                    backgroundColor: `color-mix(in srgb, ${tintColor} 15%, transparent)`,
                  }}
                >
                  Recommended
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">
                Use the hosted version
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                This instance is live at{" "}
                <span className="text-zinc-200 font-medium">ftrepo.xyz</span> — ready to
                use with no setup required. Just add the source to your signer
                and go.
              </p>
              <button
                onClick={() =>
                  integrationsRef.current?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
                className="text-xs font-medium transition-colors duration-200 hover:brightness-125"
                style={{ color: tintColor }}
              >
                Add source &darr;
              </button>
            </div>

            <a
              href="https://github.com/ftrepoxyz/FTRepo"
              target="_blank"
              rel="noopener noreferrer"
              className="hp-reveal group relative overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-6 hover:border-zinc-700 hover:bg-zinc-900/70 transition-all duration-300"
              style={{ transitionDelay: "80ms" }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ backgroundColor: tintColor }}
              />
              <Github
                className="h-5 w-5 mb-3"
                style={{ color: tintColor }}
              />
              <h3 className="text-sm font-semibold text-white mb-1.5">
                Self-host your own
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed mb-4">
                FTRepo is fully open source. Deploy your own instance, connect
                your Telegram channels, and run a private repository.
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors duration-200">
                View on GitHub
                <ExternalLink className="h-3 w-3" />
              </span>
            </a>
          </div>
        </div>
      </section>

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
                      className="hp-reveal group flex items-center gap-4 rounded-xl border border-zinc-800/50 bg-zinc-900/30 px-5 py-3.5 hover:bg-zinc-800/50 hover:border-zinc-700 hover:translate-x-0.5 transition-all duration-200"
                      style={{ transitionDelay: `${i * 60}ms` }}
                    >
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0">
                        {signerIcons[signer.name] ? (
                          signerIcons[signer.name]
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: signer.color }}
                          >
                            {signer.name.charAt(0)}
                          </div>
                        )}
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
        <button
          onClick={scrollToTop}
          className="inline-flex items-center gap-1.5 text-[11px] text-zinc-700 hover:text-zinc-400 transition-colors duration-200 mb-4"
        >
          <ArrowUp className="h-3 w-3" />
          Back to top
        </button>
        <p className="text-[11px] text-zinc-700">
          &copy; {new Date().getFullYear()} {sourceName}
        </p>
      </footer>
    </div>
  );
}
