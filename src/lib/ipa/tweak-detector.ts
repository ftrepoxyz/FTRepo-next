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

export interface TweakDetectionResult {
  isTweaked: boolean;
  tweaks: string[];
  dylibPaths: string[];
}

export function detectTweaks(dylibPaths: string[]): TweakDetectionResult {
  const injectedDylibs: string[] = [];

  for (const path of dylibPaths) {
    const isAppleFramework = APPLE_FRAMEWORK_PREFIXES.some((prefix) =>
      path.startsWith(prefix)
    );

    const fileName = path.split("/").pop() || "";
    const isAppleDylib = APPLE_DYLIB_NAMES.has(fileName);

    // Swift support libraries bundled in the app (not injected)
    const isSwiftSupport =
      path.includes("/Frameworks/libswift") ||
      path.includes("/SwiftSupport/");

    if (!isAppleFramework && !isAppleDylib && !isSwiftSupport) {
      injectedDylibs.push(path);
    }
  }

  // Extract tweak names from paths
  const tweakNames = injectedDylibs.map((path) => {
    const fileName = path.split("/").pop() || path;
    return fileName.replace(/\.dylib$/, "").replace(/\.framework$/, "");
  });

  return {
    isTweaked: injectedDylibs.length > 0,
    tweaks: tweakNames,
    dylibPaths: injectedDylibs,
  };
}
