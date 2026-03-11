import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { listReleases } from "@/lib/github/releases";
import { fetchPublishedJsonFile } from "@/lib/github/json-publisher";
import { getSettings } from "@/lib/config";
import { logger } from "@/lib/logger";
import {
  buildAppNameOverrideMaps,
  getVariantMeta,
  resolveDisplayName,
  shouldKeepIpaForLockedChannel,
  type RenameScope,
} from "@/lib/json/grouping";

interface IpaAsset {
  assetId: number;
  assetName: string;
  downloadUrl: string;
  size: number;
  releaseId: number;
  releaseTag: string;
}

interface LibraryItem {
  assetId: number;
  assetName: string;
  downloadUrl: string;
  size: number;
  releaseId: number;
  releaseTag: string;
  dbId: number | null;
  appName: string;
  bundleId: string;
  version: string;
  isTweaked: boolean;
  channelId: string | null;
  fileSize: number;
  createdAt: string;
  groupKey: string;
  matchedTweak: string | null;
  renameScope: RenameScope;
  displayName: string;
}

interface FeatherVersion {
  version?: string;
  downloadURL?: string | null;
}

interface FeatherApp {
  name: string;
  bundleIdentifier: string;
  downloadURL?: string | null;
  versions?: FeatherVersion[];
}

/**
 * Parse an IPA asset filename to extract bundleId and version.
 * Format: `${bundleId}${tweakSlug}_${version}.ipa`
 */
function parseAssetName(name: string): { bundleId: string; version: string } | null {
  if (!name.toLowerCase().endsWith(".ipa")) return null;

  const withoutExt = name.slice(0, -4);
  const lastUnderscore = withoutExt.lastIndexOf("_");
  if (lastUnderscore === -1) return null;

  const version = withoutExt.slice(lastUnderscore + 1);
  const prefix = withoutExt.slice(0, lastUnderscore);
  const parts = prefix.split("_");
  const bundleIdParts: string[] = [];

  for (const part of parts) {
    if (part.includes(".") || bundleIdParts.length === 0) {
      bundleIdParts.push(part);
    } else {
      break;
    }
  }

  const bundleId = bundleIdParts.join("_");
  return { bundleId, version };
}

function parseFeatherApps(content: string | null): FeatherApp[] {
  if (!content) return [];

  try {
    const parsed = JSON.parse(content) as { apps?: FeatherApp[] };
    return Array.isArray(parsed.apps) ? parsed.apps : [];
  } catch {
    return [];
  }
}

function appUrls(app: FeatherApp): Set<string> {
  const urls = new Set<string>();

  if (app.downloadURL) urls.add(app.downloadURL);
  for (const version of app.versions || []) {
    if (version.downloadURL) urls.add(version.downloadURL);
  }

  return urls;
}

function resolvePublishedNames(items: LibraryItem[], featherApps: FeatherApp[]): Map<string, string> {
  const names = new Map<string, string>();
  const byBundleId = new Map<string, LibraryItem[]>();

  for (const item of items) {
    const list = byBundleId.get(item.bundleId) || [];
    list.push(item);
    byBundleId.set(item.bundleId, list);
  }

  for (const [bundleId, bundleItems] of byBundleId) {
    const apps = featherApps.filter((app) => app.bundleIdentifier === bundleId);
    if (apps.length === 0) continue;

    const localGroups = new Map<string, Set<string>>();
    for (const item of bundleItems) {
      const urls = localGroups.get(item.groupKey) || new Set<string>();
      if (item.downloadUrl) urls.add(item.downloadUrl);
      localGroups.set(item.groupKey, urls);
    }

    const groupEntries = Array.from(localGroups.entries());
    if (groupEntries.length === 1 && apps.length === 1) {
      names.set(groupEntries[0][0], apps[0].name);
      continue;
    }

    const unusedApps = apps.map((app, index) => ({
      app,
      index,
      urls: appUrls(app),
    }));
    const usedApps = new Set<number>();
    const unresolvedGroups = new Set(groupEntries.map(([groupKey]) => groupKey));

    for (const [groupKey, urls] of groupEntries) {
      const matches = unusedApps.filter(
        ({ index, urls: publishedUrls }) =>
          !usedApps.has(index) &&
          Array.from(urls).some((url) => publishedUrls.has(url))
      );

      if (matches.length === 1) {
        names.set(groupKey, matches[0].app.name);
        usedApps.add(matches[0].index);
        unresolvedGroups.delete(groupKey);
      }
    }

    const remainingGroups = groupEntries.filter(([groupKey]) => unresolvedGroups.has(groupKey));
    const remainingApps = unusedApps.filter(({ index }) => !usedApps.has(index));
    if (remainingGroups.length === 1 && remainingApps.length === 1) {
      names.set(remainingGroups[0][0], remainingApps[0].app.name);
    }
  }

  return names;
}

export const GET = withAuth(async () => {
  try {
    const settings = await getSettings();
    const releases = await listReleases();

    const ipaAssets: IpaAsset[] = [];
    for (const release of releases) {
      for (const asset of release.assets) {
        if (asset.name.toLowerCase().endsWith(".ipa")) {
          ipaAssets.push({
            assetId: asset.id,
            assetName: asset.name,
            downloadUrl: asset.downloadUrl,
            size: asset.size,
            releaseId: release.id,
            releaseTag: release.tagName,
          });
        }
      }
    }

    const assetIds = ipaAssets.map((asset) => asset.assetId);
    const [dbRecords, overrideRows, featherRaw] = await Promise.all([
      assetIds.length > 0
        ? prisma.downloadedIpa.findMany({
            where: { githubAssetId: { in: assetIds } },
          })
        : Promise.resolve([]),
      prisma.feedAppOverride.findMany({
        select: {
          feed: true,
          groupKey: true,
          appName: true,
        },
      }),
      fetchPublishedJsonFile("feather.json"),
    ]);

    const dbByAssetId = new Map(dbRecords.map((record) => [record.githubAssetId!, record]));
    const overrides = buildAppNameOverrideMaps(overrideRows);

    const baseItems: LibraryItem[] = ipaAssets.flatMap((asset) => {
      const db = dbByAssetId.get(asset.assetId);
      if (
        db &&
        !shouldKeepIpaForLockedChannel(
          {
            appName: db.appName,
            tweaks: db.tweaks,
            channelId: db.channelId,
          },
          settings.known_tweaks
        )
      ) {
        return [];
      }

      const parsed = parseAssetName(asset.assetName);
      const bundleId = db?.bundleId ?? parsed?.bundleId ?? "";
      const appName = db?.appName ?? parsed?.bundleId ?? asset.assetName;
      const tweaks = db ? ((db.tweaks as string[]) || []) : [];
      const variant = getVariantMeta(
        bundleId,
        appName,
        tweaks,
        db?.isTweaked ?? false,
        settings.known_tweaks,
        db?.channelId
      );

      return [{
        assetId: asset.assetId,
        assetName: asset.assetName,
        downloadUrl: asset.downloadUrl,
        size: asset.size,
        releaseId: asset.releaseId,
        releaseTag: asset.releaseTag,
        dbId: db?.id ?? null,
        appName,
        bundleId,
        version: db?.version ?? parsed?.version ?? "",
        isTweaked: db?.isTweaked ?? false,
        channelId: db?.channelId ?? null,
        fileSize: db ? Number(db.fileSize) : asset.size,
        createdAt: db?.createdAt?.toISOString() ?? "",
        groupKey: variant.groupKey,
        matchedTweak: variant.matchedTweak,
        renameScope: variant.renameScope,
        displayName: "",
      }];
    });

    const publishedNames = resolvePublishedNames(baseItems, parseFeatherApps(featherRaw));
    const items = baseItems.map((item) => ({
      ...item,
      displayName: resolveDisplayName({
        appName: item.appName,
        groupKey: item.groupKey,
        matchedTweak: item.matchedTweak,
        overrides,
        feed: "library",
        publishedName: publishedNames.get(item.groupKey) ?? null,
      }),
    }));

    const channelSet = new Set<string>();
    for (const item of items) {
      if (item.channelId) channelSet.add(item.channelId);
    }

    return NextResponse.json({
      success: true,
      data: items,
      channels: Array.from(channelSet).sort(),
    });
  } catch (e) {
    await logger.error("system", "Failed to fetch library", {
      error: String(e),
    });
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
});
