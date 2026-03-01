import plist from "plist";

export interface EntitlementsResult {
  entitlements: Record<string, string>;
  raw?: Record<string, unknown>;
}

/**
 * Extract entitlements from a mobileprovision file.
 * The mobileprovision is a CMS (PKCS#7) signed envelope containing a plist.
 * We extract the plist by finding the XML boundaries.
 */
export function extractEntitlements(provisionData: Buffer): EntitlementsResult {
  const content = provisionData.toString("utf-8");

  // Find the embedded plist within the CMS envelope
  const plistStart = content.indexOf("<?xml");
  const plistEnd = content.indexOf("</plist>");

  if (plistStart === -1 || plistEnd === -1) {
    return { entitlements: {} };
  }

  const plistXml = content.substring(plistStart, plistEnd + "</plist>".length);

  try {
    const parsed = plist.parse(plistXml) as Record<string, unknown>;
    const entitlementsDict = parsed.Entitlements as Record<string, unknown> | undefined;

    if (!entitlementsDict) {
      return { entitlements: {}, raw: parsed };
    }

    // Convert entitlements to human-readable format
    const entitlements: Record<string, string> = {};
    for (const [key, value] of Object.entries(entitlementsDict)) {
      entitlements[key] = formatEntitlementValue(value);
    }

    return { entitlements, raw: entitlementsDict as Record<string, unknown> };
  } catch {
    return { entitlements: {} };
  }
}

function formatEntitlementValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(", ");
  return JSON.stringify(value);
}

// Common entitlement keys and their human-readable names
export const ENTITLEMENT_NAMES: Record<string, string> = {
  "com.apple.security.application-groups": "App Groups",
  "com.apple.developer.associated-domains": "Associated Domains",
  "com.apple.developer.icloud-container-identifiers": "iCloud Containers",
  "com.apple.developer.in-app-payments": "In-App Payments",
  "com.apple.developer.networking.vpn.api": "VPN API",
  "com.apple.developer.siri": "Siri",
  "com.apple.developer.healthkit": "HealthKit",
  "com.apple.developer.homekit": "HomeKit",
  "com.apple.developer.nfc.readersession.formats": "NFC",
  "aps-environment": "Push Notifications",
  "com.apple.developer.applesignin": "Sign in with Apple",
  "keychain-access-groups": "Keychain Access",
  "com.apple.developer.networking.wifi-info": "Wi-Fi Info",
  "com.apple.developer.game-center": "Game Center",
};
