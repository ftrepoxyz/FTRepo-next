import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Default settings
  const defaultSettings = [
    { key: "scan_interval_minutes", value: "30", type: "number" },
    { key: "json_regen_interval_minutes", value: "60", type: "number" },
    { key: "cleanup_interval_hours", value: "24", type: "number" },
    { key: "max_versions_per_app", value: "5", type: "number" },
    { key: "log_retention_days", value: "30", type: "number" },
    { key: "auto_scan_enabled", value: "true", type: "boolean" },
    { key: "auto_json_regen", value: "true", type: "boolean" },
    { key: "auto_cleanup", value: "true", type: "boolean" },
    {
      key: "source_name",
      value: "FTRepo",
      type: "string",
    },
    {
      key: "source_description",
      value: "Automated iOS IPA distribution",
      type: "string",
    },
    { key: "site_domain", value: "", type: "string" },
    { key: "telegram_api_id", value: "", type: "string" },
    { key: "telegram_api_hash", value: "", type: "string" },
    { key: "telegram_phone", value: "", type: "string" },
    { key: "github_token", value: "", type: "string" },
    { key: "github_owner", value: "", type: "string" },
    { key: "github_repo", value: "", type: "string" },
    { key: "github_branch", value: "main", type: "string" },
    { key: "appstore_country", value: "us", type: "string" },
    { key: "temp_dir", value: "/tmp/ftrepo", type: "string" },
    {
      key: "known_tweaks",
      value: JSON.stringify([]),
      type: "json",
    },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  // Common entitlement descriptions
  const privacyDescriptions = [
    {
      key: "NSCameraUsageDescription",
      description: "Access to camera for taking photos and videos",
    },
    {
      key: "NSMicrophoneUsageDescription",
      description: "Access to microphone for audio recording",
    },
    {
      key: "NSPhotoLibraryUsageDescription",
      description: "Access to photo library for saving and selecting images",
    },
    {
      key: "NSPhotoLibraryAddUsageDescription",
      description: "Access to save photos to your library",
    },
    {
      key: "NSLocationWhenInUseUsageDescription",
      description: "Access to location while using the app",
    },
    {
      key: "NSLocationAlwaysUsageDescription",
      description: "Access to location in the background",
    },
    {
      key: "NSContactsUsageDescription",
      description: "Access to contacts",
    },
    {
      key: "NSCalendarsUsageDescription",
      description: "Access to calendar events",
    },
    {
      key: "NSFaceIDUsageDescription",
      description: "Face ID for authentication",
    },
    {
      key: "NSBluetoothAlwaysUsageDescription",
      description: "Access to Bluetooth for connecting devices",
    },
    {
      key: "NSLocalNetworkUsageDescription",
      description: "Access to local network for device discovery",
    },
    {
      key: "NSUserTrackingUsageDescription",
      description: "Permission to track activity across apps and websites",
    },
  ];

  for (const desc of privacyDescriptions) {
    await prisma.privacyDescriptionCache.upsert({
      where: { key: desc.key },
      update: {},
      create: desc,
    });
  }

  console.log("Seed completed successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
