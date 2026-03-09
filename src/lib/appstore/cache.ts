import { prisma } from "../db";
import { lookupApp } from "./lookup";
import { enhanceAppleScreenshotUrls } from "./images";
import { AppStoreLookup } from "@/types/models";

const CACHE_DAYS = 30;

/**
 * Get App Store metadata with a 30-day DB cache layer.
 */
export async function getCachedLookup(bundleId: string): Promise<AppStoreLookup | null> {
  // Check cache first
  const cached = await prisma.appStoreCache.findUnique({
    where: { bundleId },
  });

  if (cached && new Date() < cached.expiresAt) {
    const screenshots = enhanceAppleScreenshotUrls(cached.screenshots);
    return {
      bundleId: cached.bundleId,
      appName: cached.appName || "",
      iconUrl: cached.iconUrl || "",
      screenshots,
      description: cached.description || "",
      developer: cached.developer || "",
      genre: cached.genre || "",
      price: cached.price || 0,
      rating: cached.rating || 0,
    };
  }

  // Fetch from API
  const result = await lookupApp(bundleId);
  if (!result) return null;
  const screenshots = enhanceAppleScreenshotUrls(result.screenshots);

  // Update cache
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CACHE_DAYS);

  await prisma.appStoreCache.upsert({
    where: { bundleId },
    update: {
      appName: result.appName,
      iconUrl: result.iconUrl,
      screenshots,
      description: result.description,
      developer: result.developer,
      genre: result.genre,
      price: result.price,
      rating: result.rating,
      data: JSON.parse(JSON.stringify(result)),
      fetchedAt: new Date(),
      expiresAt,
    },
    create: {
      bundleId,
      appName: result.appName,
      iconUrl: result.iconUrl,
      screenshots,
      description: result.description,
      developer: result.developer,
      genre: result.genre,
      price: result.price,
      rating: result.rating,
      data: JSON.parse(JSON.stringify(result)),
      expiresAt,
    },
  });

  return {
    ...result,
    screenshots,
  };
}

/**
 * Clear expired cache entries.
 */
export async function clearExpiredCache(): Promise<number> {
  const result = await prisma.appStoreCache.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

/**
 * Clear all cache entries.
 */
export async function clearAllCache(): Promise<number> {
  const result = await prisma.appStoreCache.deleteMany();
  return result.count;
}
