import { prisma } from "../db";

/**
 * Cache and manage privacy usage descriptions learned from IPA files.
 * When a new NS*UsageDescription is found, it's stored for reuse.
 */
export async function cachePrivacyDescriptions(
  descriptions: Record<string, string>
): Promise<void> {
  for (const [key, description] of Object.entries(descriptions)) {
    if (!description) continue;

    try {
      const existing = await prisma.privacyDescriptionCache.findUnique({
        where: { key },
      });

      if (existing) {
        await prisma.privacyDescriptionCache.update({
          where: { key },
          data: {
            usageCount: { increment: 1 },
            // Update description if new one is longer/more detailed
            ...(description.length > existing.description.length
              ? { description }
              : {}),
          },
        });
      } else {
        await prisma.privacyDescriptionCache.create({
          data: { key, description },
        });
      }
    } catch {
      // Ignore cache errors - non-critical
    }
  }
}

/**
 * Get cached description for a privacy key.
 * Falls back to a generic description if not cached.
 */
export async function getPrivacyDescription(key: string): Promise<string> {
  try {
    const cached = await prisma.privacyDescriptionCache.findUnique({
      where: { key },
    });
    if (cached) return cached.description;
  } catch {
    // Ignore cache errors
  }

  return FALLBACK_DESCRIPTIONS[key] || `This app uses ${formatKey(key)}`;
}

function formatKey(key: string): string {
  return key
    .replace(/^NS/, "")
    .replace(/UsageDescription$/, "")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .toLowerCase();
}

const FALLBACK_DESCRIPTIONS: Record<string, string> = {
  NSCameraUsageDescription: "Access to camera for taking photos and videos",
  NSMicrophoneUsageDescription: "Access to microphone for audio recording",
  NSPhotoLibraryUsageDescription: "Access to photo library",
  NSPhotoLibraryAddUsageDescription: "Save photos to your library",
  NSLocationWhenInUseUsageDescription: "Location access while using the app",
  NSLocationAlwaysUsageDescription: "Location access in the background",
  NSContactsUsageDescription: "Access to contacts",
  NSCalendarsUsageDescription: "Access to calendar events",
  NSFaceIDUsageDescription: "Face ID for authentication",
  NSBluetoothAlwaysUsageDescription: "Bluetooth for connecting devices",
};
