// Apple system frameworks that should not be flagged as injected tweaks
const APPLE_FRAMEWORK_PREFIXES = [
  "/System/Library/",
  "/usr/lib/",
  "@rpath/lib",
  "/Library/Frameworks/",
];

const APPLE_DYLIB_NAMES = new Set([
  "libswiftCore.dylib",
  "libswiftFoundation.dylib",
  "libswiftDispatch.dylib",
  "libswiftUIKit.dylib",
  "libswiftCoreGraphics.dylib",
  "libswiftDarwin.dylib",
  "libswiftObjectiveC.dylib",
  "libswiftCoreFoundation.dylib",
  "libswiftMetal.dylib",
  "libswiftCoreImage.dylib",
  "libswiftCoreMedia.dylib",
  "libswiftAVFoundation.dylib",
  "libswiftCoreLocation.dylib",
  "libswiftos.dylib",
  "libswiftCoreData.dylib",
  "libswiftNetwork.dylib",
  "libswiftCombine.dylib",
  "libswiftMapKit.dylib",
  "libswift_Concurrency.dylib",
  "libswift_StringProcessing.dylib",
  "libswiftRegexBuilder.dylib",
]);

// Known jailbreak/tweak-related frameworks (indicators that the app is tweaked)
const KNOWN_TWEAK_FRAMEWORKS = new Set([
  "CydiaSubstrate",
  "CepheiPrefs",
  "Cephei",
  "CepheiUI",
  "substrate",
  "Alderis",
  "AltList",
  "libhdev",
  "RocketBootstrap",
  "AppList",
  "Flipswitch",
  "TechSupport",
  "Orion",
]);

export interface TweakDetectionResult {
  isTweaked: boolean;
  tweaks: string[];
  dylibPaths: string[];
}

/**
 * Detect tweaks from a list of dylib files and framework names.
 *
 * Input paths are either:
 * - Standalone .dylib files (e.g., "Frameworks/BHTwitter.dylib")
 * - Framework names (e.g., "CydiaSubstrate.framework")
 *
 * Tweak names are derived from standalone .dylib files only, since
 * framework names can't reliably distinguish tweaks from legitimate SDKs.
 * Known jailbreak frameworks (CydiaSubstrate, Cephei, etc.) are used
 * as additional signals for the isTweaked flag.
 */
export function detectTweaks(dylibPaths: string[]): TweakDetectionResult {
  const tweakNames: string[] = [];
  const injectedPaths: string[] = [];
  let hasKnownTweakFramework = false;

  for (const path of dylibPaths) {
    // Handle framework names (e.g., "CydiaSubstrate.framework")
    if (path.endsWith(".framework")) {
      const name = path.replace(/\.framework$/, "");
      if (KNOWN_TWEAK_FRAMEWORKS.has(name)) {
        hasKnownTweakFramework = true;
        injectedPaths.push(path);
      }
      continue;
    }

    // Handle .dylib files
    const fileName = path.split("/").pop() || "";

    const isAppleFramework = APPLE_FRAMEWORK_PREFIXES.some((prefix) =>
      path.startsWith(prefix)
    );
    const isAppleDylib = APPLE_DYLIB_NAMES.has(fileName);
    const isSwiftSupport =
      path.includes("/Frameworks/libswift") ||
      path.includes("/SwiftSupport/") ||
      fileName.startsWith("libswift");

    if (!isAppleFramework && !isAppleDylib && !isSwiftSupport) {
      injectedPaths.push(path);
      tweakNames.push(fileName.replace(/\.dylib$/, ""));
    }
  }

  const uniqueTweaks = [...new Set(tweakNames)];

  return {
    isTweaked: uniqueTweaks.length > 0 || hasKnownTweakFramework,
    tweaks: uniqueTweaks,
    dylibPaths: injectedPaths,
  };
}
