import test from "node:test";
import assert from "node:assert/strict";
import type { DownloadedIpa } from "@prisma/client";
import type { TweakConfig } from "@/types/config";
import {
  getLatestPerCompositeKey,
  groupByCompositeKey,
} from "./grouping";

function buildIpa(overrides: Partial<DownloadedIpa>): DownloadedIpa {
  return {
    id: overrides.id ?? 1,
    bundleId: overrides.bundleId ?? "com.example.app",
    appName: overrides.appName ?? "Example App",
    version: overrides.version ?? "1.0.0",
    buildNumber: overrides.buildNumber ?? null,
    minOsVersion: overrides.minOsVersion ?? null,
    fileName: overrides.fileName ?? "example.ipa",
    fileSize: overrides.fileSize ?? BigInt(1024),
    iconUrl: overrides.iconUrl ?? null,
    screenshotUrls: overrides.screenshotUrls ?? [],
    description: overrides.description ?? null,
    developerName: overrides.developerName ?? null,
    tweaks: overrides.tweaks ?? [],
    isTweaked: overrides.isTweaked ?? false,
    entitlements: overrides.entitlements ?? {},
    privacyInfo: overrides.privacyInfo ?? {},
    githubReleaseId: overrides.githubReleaseId ?? null,
    githubAssetId: overrides.githubAssetId ?? null,
    githubAssetUrl: overrides.githubAssetUrl ?? null,
    downloadUrl: overrides.downloadUrl ?? "https://example.com/app.ipa",
    downloadCount: overrides.downloadCount ?? 0,
    channelId: overrides.channelId ?? null,
    messageId: overrides.messageId ?? null,
    isCorrupted: overrides.isCorrupted ?? false,
    corruptionNote: overrides.corruptionNote ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-03-10T10:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-03-10T10:00:00.000Z"),
  };
}

test("groupByCompositeKey excludes locked app matches from the wrong channel", () => {
  const knownTweaks: TweakConfig[] = [
    { name: "SoundCloud", lockedChannelId: "@soundcloudipas" },
  ];

  const grouped = groupByCompositeKey(
    [
      buildIpa({
        id: 1,
        appName: "SoundCloud",
        bundleId: "com.soundcloud.TouchApp",
        channelId: "@othersource",
      }),
      buildIpa({
        id: 2,
        appName: "SoundCloud",
        bundleId: "com.soundcloud.TouchApp",
        channelId: "@soundcloudipas",
        createdAt: new Date("2026-03-10T11:00:00.000Z"),
      }),
    ],
    knownTweaks
  );

  assert.equal(grouped.size, 1);
  const onlyGroup = Array.from(grouped.values())[0];
  assert.equal(onlyGroup.ipas.length, 1);
  assert.equal(onlyGroup.ipas[0]?.channelId, "@soundcloudipas");
});

test("getLatestPerCompositeKey ignores newer wrong-channel IPAs for locked tweak variants", () => {
  const knownTweaks: TweakConfig[] = [
    { name: "YouTube OLED", lockedChannelId: "@binnichtaktivsipas" },
  ];

  const latest = getLatestPerCompositeKey(
    [
      buildIpa({
        id: 1,
        appName: "YouTube OLED",
        bundleId: "com.google.ios.youtube",
        version: "20.10.1",
        isTweaked: true,
        tweaks: ["YouTube OLED"],
        channelId: "@wrongchannel",
        createdAt: new Date("2026-03-10T12:00:00.000Z"),
      }),
      buildIpa({
        id: 2,
        appName: "YouTube OLED",
        bundleId: "com.google.ios.youtube",
        version: "20.9.9",
        isTweaked: true,
        tweaks: ["YouTube OLED"],
        channelId: "@binnichtaktivsipas",
        createdAt: new Date("2026-03-10T11:00:00.000Z"),
      }),
    ],
    knownTweaks
  );

  assert.equal(latest.length, 1);
  assert.equal(latest[0]?.ipa.channelId, "@binnichtaktivsipas");
  assert.equal(latest[0]?.matchedTweak, "YouTube OLED");
});
