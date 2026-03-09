import Image from "next/image";
import {
  ArrowDown,
  Ban,
  Check,
  Copy,
  Crown,
  ExternalLink,
  Github,
  Globe,
  Infinity,
  Lock,
  LogIn,
  Package,
  Settings,
} from "lucide-react";
import { BackToTopButton } from "@/components/start-page/back-to-top-button";
import { DeferredStartPageCarousel } from "@/components/start-page/carousel-shell";
import { CopyButton } from "@/components/start-page/copy-button";
import { ScrollButton } from "@/components/start-page/scroll-button";

interface StartPageProps {
  sourceName: string;
  sourceSubtitle: string;
  baseUrl: string | null;
  tintColor: string;
  siteDomain: string;
}

const signers = [
  ["SideStore", "sidestore://source?url=", "#8B5CF6", "store.json", "store"],
  ["AltStore Classic", "altstore-classic://source?url=", "#14B8A6", "store.json", "store"],
  ["Feather", "feather://source/", "#EC4899", "feather.json", "feather"],
  ["StikStore", "stikstore://add-source?url=", "#2997FF", "store.json", "store"],
  ["LiveContainer", "livecontainer://source?url=", "#34C759", "store.json", "store"],
] as const;

const signerIcons: Record<string, string> = {
  SideStore: "/icons/sidestore.png",
  "AltStore Classic": "/icons/altstore.png",
  Feather: "/icons/feather.png",
  StikStore: "/icons/stikstore.png",
  LiveContainer: "/icons/livecontainer.png",
};

const perks = [
  [Ban, "No Ads", "Every app is completely ad-free. No banners, no pop-ups, no interruptions."],
  [Crown, "Premium Unlocked", "All paid features and subscriptions are fully unlocked out of the box."],
  [Infinity, "No Limits", "Usage restrictions, upload caps, and artificial limits are removed."],
  [Lock, "Revoke Protection", "Apps are signed to minimize revokes so they keep working."],
] as const;

const otherFormats = [
  ["ESign", "esign.json", "esign"],
  ["Scarlet", "scarlet.json", "scarlet"],
] as const;

const shortUrlFormats = [
  ["Feather", "/feather"],
  ["ESign", "/esign"],
  ["Scarlet", "/scarlet"],
  ["Store", "/store"],
] as const;

function revealStyle(delayMs: number) {
  return { animationDelay: `${delayMs}ms` };
}

export function StartPage({
  sourceName,
  sourceSubtitle,
  baseUrl,
  tintColor,
  siteDomain,
}: StartPageProps) {
  const usesShortUrls = Boolean(siteDomain);
  const storeUrl = baseUrl
    ? baseUrl + (usesShortUrls ? "store" : "store.json")
    : null;

  return (
    <div className="min-h-dvh overflow-x-hidden bg-zinc-950 text-zinc-300 selection:bg-white/10">
      <div
        className="pointer-events-none fixed left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px] opacity-[0.06]"
        style={{ backgroundColor: tintColor }}
      />

      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-zinc-800/40 bg-zinc-950/70 px-6 py-5 backdrop-blur-md lg:px-12">
        <span
          className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-600"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {sourceName}
        </span>
        <a
          href="/login"
          className="flex items-center gap-2 text-xs text-zinc-600 transition-colors duration-200 hover:text-zinc-300"
        >
          <LogIn className="h-3.5 w-3.5" />
          Admin
        </a>
      </header>

      <section className="relative z-10 flex min-h-[88vh] flex-col items-center justify-center px-6 hp-stagger">
        <div
          className="hp-float mb-8 flex h-14 w-14 items-center justify-center rounded-[14px] border border-zinc-800 bg-zinc-900/80"
          style={{ borderColor: `color-mix(in srgb, ${tintColor} 25%, transparent)` }}
        >
          <Package className="h-7 w-7" style={{ color: tintColor }} />
        </div>
        <div
          className="mb-6 flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium"
          style={{
            borderColor: `color-mix(in srgb, ${tintColor} 25%, transparent)`,
            color: tintColor,
            backgroundColor: `color-mix(in srgb, ${tintColor} 8%, transparent)`,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: tintColor }}
          />
          Automated iOS Repository
        </div>
        <h1
          className="text-center text-5xl font-bold tracking-tight text-white sm:text-7xl lg:text-8xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {sourceName}
        </h1>
        <p className="mt-4 max-w-md text-center text-base text-zinc-500 sm:text-lg">
          {sourceSubtitle}
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <ScrollButton
            targetId="integrations"
            className="rounded-full px-8 py-3.5 text-sm font-medium text-white transition-all duration-200 hover:scale-105 hover:brightness-110 active:scale-[0.98]"
            style={{
              backgroundColor: tintColor,
              boxShadow: `0 0 24px color-mix(in srgb, ${tintColor} 35%, transparent)`,
            }}
          >
            Add to Your App
          </ScrollButton>
          <ScrollButton
            targetId="about"
            className="text-sm text-zinc-600 transition-colors duration-200 hover:text-zinc-300"
          >
            Learn more
          </ScrollButton>
        </div>
        <div className="absolute bottom-10 animate-bounce text-zinc-700">
          <ArrowDown className="h-4 w-4" />
        </div>
      </section>

      <section className="relative z-10 px-6 py-16">
        <DeferredStartPageCarousel />
      </section>

      <section className="relative z-10 px-6 pt-8 pb-20 sm:pb-28">
        <div className="mx-auto max-w-md sm:max-w-3xl">
          <div className="hp-reveal mb-10 text-center">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.25em] text-zinc-600">
              What you get
            </p>
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Every app, fully loaded
            </h2>
          </div>
          <div className="space-y-3 sm:grid sm:grid-cols-4 sm:gap-4 sm:space-y-0">
            {perks.map(([Icon, title, desc], index) => (
              <div
                key={title}
                className="hp-reveal flex items-center gap-4 rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3.5 transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900/70 sm:flex-col sm:p-5 sm:text-center"
                style={revealStyle(index * 80)}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 sm:mb-3 sm:h-10 sm:w-10"
                  style={{ borderColor: `color-mix(in srgb, ${tintColor} 20%, transparent)` }}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: tintColor }} />
                </div>
                <div className="sm:contents">
                  <h3 className="text-sm font-semibold text-white sm:mb-1">{title}</h3>
                  <p className="hidden text-xs leading-relaxed text-zinc-500 sm:block">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <div className="hp-reveal">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.25em] text-zinc-600">About</p>
            <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl">What is {sourceName}?</h2>
            <p className="max-w-xl leading-relaxed text-zinc-500">
              An open-source iOS app repository that automatically discovers tweaked and modded apps from Telegram,
              processes them, and generates feeds for every major signer, so you can browse and install with a single tap.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div
              className="hp-reveal hp-shiny-card rounded-xl p-6 transition-all duration-300"
              style={{
                ...revealStyle(80),
                border: `1px solid color-mix(in srgb, ${tintColor} 30%, transparent)`,
                background: `linear-gradient(135deg, color-mix(in srgb, ${tintColor} 10%, rgb(24 24 27)) 0%, rgb(24 24 27 / 0.9) 100%)`,
                boxShadow: `0 0 40px color-mix(in srgb, ${tintColor} 18%, transparent), 0 0 80px color-mix(in srgb, ${tintColor} 6%, transparent)`,
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <Globe className="h-5 w-5" style={{ color: tintColor }} />
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    color: tintColor,
                    backgroundColor: `color-mix(in srgb, ${tintColor} 15%, transparent)`,
                  }}
                >
                  Recommended
                </span>
              </div>
              <h3 className="mb-1.5 text-sm font-semibold text-white">Use the hosted version</h3>
              <p className="mb-4 text-sm leading-relaxed text-zinc-400">
                The main instance is live at <span className="font-medium text-zinc-200">ftrepo.xyz</span> and ready to use
                with no setup. Just add the source to your signer and go.
              </p>
              <ScrollButton
                targetId="integrations"
                className="text-xs font-medium transition-colors duration-200 hover:brightness-125"
                style={{ color: tintColor }}
              >
                Add source &darr;
              </ScrollButton>
            </div>

            <a
              href="https://github.com/ftrepoxyz/FTRepo"
              target="_blank"
              rel="noopener noreferrer"
              className="hp-reveal group relative overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-6 transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900/70"
              style={revealStyle(160)}
            >
              <div
                className="absolute left-0 right-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ backgroundColor: tintColor }}
              />
              <Github className="mb-3 h-5 w-5" style={{ color: tintColor }} />
              <h3 className="mb-1.5 text-sm font-semibold text-white">Self-host your own</h3>
              <p className="mb-4 text-sm leading-relaxed text-zinc-500">
                FTRepo is fully open source. Deploy your own instance, connect your Telegram channels, and run a private repository.
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors duration-200 group-hover:text-zinc-200">
                View on GitHub
                <ExternalLink className="h-3 w-3" />
              </span>
            </a>
          </div>
        </div>
      </section>

      <section id="integrations" className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-md">
          <div className="hp-reveal mb-12 text-center">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.25em] text-zinc-600">Get started</p>
            <h2 className="mb-2 text-2xl font-bold text-white sm:text-3xl">Add to Your App</h2>
            <p className="text-sm text-zinc-500">Choose your preferred signer</p>
          </div>

          {baseUrl ? (
            <>
              <div className="hp-reveal mb-8 flex items-center gap-3 rounded-lg border border-zinc-800/60 bg-zinc-900/50 px-4 py-3">
                <code className="flex-1 truncate font-mono text-xs text-zinc-500">{storeUrl}</code>
                {storeUrl ? (
                  <CopyButton
                    text={storeUrl}
                    title="Copy source URL"
                    className="shrink-0 rounded p-1.5 text-zinc-600 transition-colors duration-200 hover:text-zinc-300"
                    idleContent={<Copy className="h-4 w-4" />}
                    copiedContent={<Check className="h-4 w-4 text-emerald-400" />}
                  />
                ) : null}
              </div>

              <div className="mb-8 space-y-2.5">
                {signers.map(([name, scheme, color, file, path], index) => {
                  const url = baseUrl + (usesShortUrls ? path : file);
                  return (
                    <a
                      key={name}
                      href={`${scheme}${url}`}
                      className="hp-reveal group flex items-center gap-4 rounded-xl border border-zinc-800/50 bg-zinc-900/30 px-5 py-3.5 transition-all duration-200 hover:translate-x-0.5 hover:border-zinc-700 hover:bg-zinc-800/50"
                      style={revealStyle(index * 60)}
                    >
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                        {signerIcons[name] ? (
                          <Image
                            src={signerIcons[name]}
                            alt={name}
                            width={36}
                            height={36}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: color }}>
                            {name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <span className="flex-1 text-sm font-medium text-zinc-200">Open in {name}</span>
                      <ExternalLink className="h-3.5 w-3.5 text-zinc-700 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                    </a>
                  );
                })}
              </div>

              <div className="hp-reveal" style={revealStyle(240)}>
                <p className="mb-3 text-center text-[11px] uppercase tracking-[0.2em] text-zinc-700">Other formats</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {otherFormats.map(([name, file, path]) => {
                    const url = baseUrl + (usesShortUrls ? path : file);
                    return (
                      <CopyButton
                        key={name}
                        text={url}
                        title={`Copy ${name} URL`}
                        className="flex items-center justify-center gap-2 rounded-lg border border-zinc-800/50 bg-zinc-900/30 px-4 py-2.5 text-xs text-zinc-500 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-800/50 hover:text-zinc-300"
                        idleContent={
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            {name}
                          </>
                        }
                        copiedContent={
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            Copied
                          </>
                        }
                      />
                    );
                  })}
                </div>
              </div>

              {siteDomain ? (
                <div className="hp-reveal mt-6" style={revealStyle(320)}>
                  <p className="mb-3 text-center text-[11px] uppercase tracking-[0.2em] text-zinc-700">Short URLs</p>
                  <div className="space-y-2">
                    {shortUrlFormats.map(([name, path]) => {
                      const shortUrl = `${siteDomain}${path}`;
                      return (
                        <div key={name} className="flex items-center gap-3 rounded-lg border border-zinc-800/50 bg-zinc-900/30 px-4 py-2.5">
                          <span className="w-16 shrink-0 text-xs font-medium text-zinc-400">{name}</span>
                          <code className="flex-1 truncate font-mono text-xs text-zinc-500">{shortUrl}</code>
                          <CopyButton
                            text={shortUrl}
                            title={`Copy ${name} short URL`}
                            className="shrink-0 rounded p-1 text-zinc-600 transition-colors duration-200 hover:text-zinc-300"
                            idleContent={<Copy className="h-3.5 w-3.5" />}
                            copiedContent={<Check className="h-3.5 w-3.5 text-emerald-400" />}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="hp-reveal space-y-4 text-center">
              <div className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50">
                <Settings className="h-6 w-6 text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-500">Repository source not configured yet.</p>
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

      <footer className="relative z-10 py-10 text-center">
        <div className="mx-auto mb-6 h-px w-8 bg-zinc-800/60" />
        <BackToTopButton className="mb-4 inline-flex items-center gap-1.5 text-[11px] text-zinc-700 transition-colors duration-200 hover:text-zinc-400" />
        <p className="text-[11px] text-zinc-700">&copy; {new Date().getFullYear()} {sourceName}</p>
      </footer>
    </div>
  );
}
