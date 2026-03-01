import { getSettings } from "../config";
import { AppStoreLookup } from "@/types/models";

interface iTunesResult {
  bundleId: string;
  trackName: string;
  artworkUrl512?: string;
  artworkUrl100?: string;
  screenshotUrls?: string[];
  description?: string;
  artistName?: string;
  primaryGenreName?: string;
  price?: number;
  averageUserRating?: number;
}

/**
 * Look up app metadata from the iTunes Search API.
 */
export async function lookupApp(bundleId: string): Promise<AppStoreLookup | null> {
  const settings = await getSettings();
  const country = settings.appstore_country;
  const url = `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(bundleId)}&country=${country}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "FTRepo/1.0" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { resultCount: number; results: iTunesResult[] };
    if (data.resultCount === 0 || !data.results[0]) return null;

    const result = data.results[0];

    return {
      bundleId: result.bundleId,
      appName: result.trackName,
      iconUrl: result.artworkUrl512 || result.artworkUrl100 || "",
      screenshots: result.screenshotUrls || [],
      description: result.description || "",
      developer: result.artistName || "",
      genre: result.primaryGenreName || "",
      price: result.price || 0,
      rating: result.averageUserRating || 0,
    };
  } catch {
    return null;
  }
}
