"use client";

import dynamic from "next/dynamic";

const StartPageCarousel = dynamic(
  () =>
    import("@/components/start-page/carousel").then(
      (mod) => mod.StartPageCarousel
    ),
  {
    loading: () => (
      <div className="mx-auto max-w-4xl space-y-4">
        {[0, 1].map((row) => (
          <div key={row} className="hp-carousel">
            <div className="hp-carousel-track">
              {Array.from({ length: 12 }).map((_, index) => (
                <div
                  key={`${row}-${index}`}
                  className="hp-carousel-item animate-pulse bg-zinc-900/70"
                />
              ))}
            </div>
          </div>
        ))}
        <p className="pt-2 text-center text-[11px] uppercase tracking-[0.2em] text-zinc-600">
          Popular moddable apps
        </p>
      </div>
    ),
  }
);

export function DeferredStartPageCarousel() {
  return <StartPageCarousel />;
}
