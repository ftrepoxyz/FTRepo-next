"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type TouchEvent,
} from "react";

const carouselApps = [
  ["YouTube", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/d1/3f/f2/d13ff2d8-57a8-399e-00f0-7be52c40af6a/logo_youtube_2024_q4_color-0-0-1x_U007emarketing-0-0-0-7-0-0-0-85-220.png/128x128bb.jpg"],
  ["Spotify", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/a7/6f/ff/a76fff08-4ee7-a85e-fa75-160149936ff8/AppIcon-0-0-1x_U007epad-0-1-0-0-sRGB-85-220.png/128x128bb.jpg"],
  ["Instagram", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/44/e7/3e/44e73e4c-1819-1c3b-6032-8398e74507e5/Prod-0-0-1x_U007epad-0-1-0-sRGB-85-220.png/128x128bb.jpg"],
  ["Snapchat", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/6e/28/84/6e2884c3-efb0-0ba0-c6b0-e3ea0c6dc191/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/128x128bb.jpg"],
  ["TikTok", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/7e/7c/c0/7e7cc0ef-43f4-ee30-70da-a70aab7fa814/AppIcon_TikTok-0-0-1x_U007epad-0-1-0-0-85-220.png/128x128bb.jpg"],
  ["X", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/14/b4/3a/14b43a76-a196-e5b9-6013-99169daf9b2e/ProductionAppIcon-0-0-1x_U007emarketing-0-8-0-0-0-85-220.png/128x128bb.jpg"],
  ["WhatsApp", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/13/04/4b/13044bd1-11d0-ea3f-6eab-82d4a942092c/AppIcon-0-0-1x_U007epad-0-0-0-1-0-0-sRGB-0-85-220.png/128x128bb.jpg"],
  ["Duolingo", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/ac/be/e0/acbee052-fabb-4abd-59ee-bc17bbd492cc/AppIcon-0-0-1x_U007epad-0-1-85-220.png/128x128bb.jpg"],
  ["Facebook", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/e7/dd/ea/e7ddeaa1-8a5f-afe4-72e3-fae43b514c3c/Icon-Production-0-0-1x_U007epad-0-1-0-85-220.png/128x128bb.jpg"],
  ["Reddit", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/81/8d/53/818d5383-67d0-2fad-9be3-10d8f41035a4/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/128x128bb.jpg"],
  ["Twitch", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/4b/e0/48/4be04802-10c9-ce75-c113-ebed876dcd4a/TwitchAppIcon-0-0-1x_U007epad-0-1-0-0-0-0-85-220.png/128x128bb.jpg"],
  ["Discord", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/35/71/22/357122bd-547c-de26-b341-d5cdfe6e3e65/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/128x128bb.jpg"],
  ["Telegram", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/36/29/76/3629760f-1cb3-a478-07a5-1f5539855e1d/Telegram-0-0-1x_U007epad-0-1-0-sRGB-85-220.png/128x128bb.jpg"],
] as const;

interface CarouselRowProps {
  apps: readonly (readonly [string, string])[];
  active: boolean;
  reverse?: boolean;
}

function CarouselRow({ apps, active, reverse = false }: CarouselRowProps) {
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
  const displayed = reverse ? [...apps].reverse() : apps;

  const end = useCallback(() => {
    if (!drag.current.active || !drag.current.animation) {
      return;
    }

    drag.current.active = false;
    containerRef.current?.classList.remove("is-dragging");

    const animation = drag.current.animation;
    const pixelsPerMs = drag.current.pixelsPerMs;
    let velocity = 0;

    if (drag.current.history.length >= 2) {
      const first = drag.current.history[0];
      const last = drag.current.history[drag.current.history.length - 1];
      const dt = last.t - first.t;
      if (dt > 0) {
        velocity = (last.x - first.x) / dt;
      }
    }

    let rate = 1 + (drag.current.direction * velocity * 0.2) / pixelsPerMs;
    rate = Math.max(-4, Math.min(8, rate));

    if (Math.abs(rate - 1) < 0.15) {
      animation.playbackRate = 1;
      animation.play();
      return;
    }

    let lastFrame = performance.now();
    const applyMomentum = (now: number) => {
      const dt = now - lastFrame;
      lastFrame = now;
      animation.currentTime = ((animation.currentTime as number) || 0) + rate * dt;

      const diff = rate - 1;
      if (Math.abs(diff) < 0.05) {
        animation.playbackRate = 1;
        animation.play();
        return;
      }

      rate = 1 + diff * 0.97;
      drag.current.decayRaf = requestAnimationFrame(applyMomentum);
    };

    drag.current.decayRaf = requestAnimationFrame(applyMomentum);
  }, []);

  const begin = useCallback(
    (clientX: number) => {
      if (!active) {
        return;
      }

      const track = containerRef.current?.querySelector(
        ".hp-carousel-track"
      ) as HTMLElement | null;
      if (!track) {
        return;
      }

      const animation = track.getAnimations()[0];
      if (!animation) {
        return;
      }

      cancelAnimationFrame(drag.current.decayRaf);
      animation.pause();

      drag.current = {
        active: true,
        startX: clientX,
        animStartTime: (animation.currentTime as number) || 0,
        animation,
        pixelsPerMs: track.scrollWidth / 2 / 40000,
        direction: track.classList.contains("hp-carousel-right") ? 1 : -1,
        decayRaf: 0,
        history: [{ x: clientX, t: Date.now() }],
      };

      containerRef.current?.classList.add("is-dragging");
    },
    [active]
  );

  const move = useCallback((clientX: number) => {
    if (!drag.current.active || !drag.current.animation) {
      return;
    }

    const now = Date.now();
    drag.current.history.push({ x: clientX, t: now });
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

  useEffect(() => {
    return () => cancelAnimationFrame(drag.current.decayRaf);
  }, []);

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => begin(event.clientX);
  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => move(event.clientX);
  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => begin(event.touches[0].clientX);
  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (drag.current.active) {
      event.preventDefault();
    }
    move(event.touches[0].clientX);
  };

  return (
    <div
      className="hp-carousel"
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={end}
      onMouseLeave={end}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={end}
    >
      <div
        className={`hp-carousel-track${
          active ? (reverse ? " hp-carousel-right" : " hp-carousel-left") : ""
        }`}
      >
        {displayed.map(([name, icon], index) => (
          <div
            key={`${reverse ? "r" : "l"}-${name}-${index}`}
            className={`hp-carousel-item${active ? " hp-entering" : ""}`}
            style={active ? { animationDelay: `${Math.min(index, 12) * 60}ms` } : undefined}
          >
            {active ? (
              <Image
                src={icon}
                alt={name}
                width={64}
                height={64}
                unoptimized
                draggable={false}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-zinc-900/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                {name.slice(0, 2)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StartPageCarousel() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const doubledApps = [...carouselApps, ...carouselApps];

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(query.matches);
    updatePreference();
    query.addEventListener("change", updatePreference);
    return () => query.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setReady(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const active = ready && !reducedMotion;

  return (
    <div ref={sectionRef} className="mx-auto max-w-4xl space-y-4">
      <CarouselRow apps={doubledApps} active={active} />
      <CarouselRow apps={doubledApps} active={active} reverse />
      <p className="pt-2 text-center text-[11px] uppercase tracking-[0.2em] text-zinc-600">
        Popular moddable apps
      </p>
    </div>
  );
}
