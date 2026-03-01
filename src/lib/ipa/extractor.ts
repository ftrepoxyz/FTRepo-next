import yauzl, { Entry, ZipFile } from "yauzl";
import { parsePlist, ParsedPlist } from "./plist-parser";
import { detectTweaks, TweakDetectionResult } from "./tweak-detector";
import { extractEntitlements, EntitlementsResult } from "./entitlements";
import { IpaMetadata } from "@/types/models";

interface ExtractedIpa {
  metadata: IpaMetadata;
  plistData: ParsedPlist;
  tweakData: TweakDetectionResult;
  entitlementsData: EntitlementsResult;
}

/**
 * Extract all metadata from an IPA file.
 * An IPA is a ZIP archive containing Payload/<AppName>.app/
 */
export async function extractIpa(ipaPath: string): Promise<ExtractedIpa> {
  const zipEntries = await listZipEntries(ipaPath);

  // Find the .app directory name
  const appDirMatch = zipEntries.find((e) =>
    /^Payload\/[^/]+\.app\/Info\.plist$/.test(e.fileName)
  );
  if (!appDirMatch) {
    throw new Error("No Info.plist found in IPA — invalid app bundle");
  }

  const appDir = appDirMatch.fileName.replace(/Info\.plist$/, "");

  // Extract Info.plist
  const plistBuffer = await extractFileFromZip(ipaPath, appDirMatch.fileName);
  const plistData = parsePlist(plistBuffer);

  // Find all dylib/framework paths for tweak detection
  const dylibPaths = zipEntries
    .filter(
      (e) =>
        e.fileName.startsWith(appDir) &&
        (e.fileName.endsWith(".dylib") || e.fileName.includes(".framework/"))
    )
    .map((e) => e.fileName.replace(appDir, ""));

  const tweakData = detectTweaks(dylibPaths);

  // Extract entitlements from mobileprovision
  let entitlementsData: EntitlementsResult = { entitlements: {} };
  const provisionEntry = zipEntries.find(
    (e) => e.fileName === `${appDir}embedded.mobileprovision`
  );
  if (provisionEntry) {
    try {
      const provisionBuffer = await extractFileFromZip(
        ipaPath,
        provisionEntry.fileName
      );
      entitlementsData = extractEntitlements(provisionBuffer);
    } catch {
      // Provision extraction can fail — not critical
    }
  }

  const metadata: IpaMetadata = {
    bundleId: plistData.bundleId,
    appName: plistData.appName,
    version: plistData.version,
    buildNumber: plistData.buildNumber,
    minOsVersion: plistData.minOsVersion,
    tweaks: tweakData.tweaks,
    isTweaked: tweakData.isTweaked,
    entitlements: entitlementsData.entitlements,
    privacyInfo: plistData.privacyDescriptions,
  };

  return { metadata, plistData, tweakData, entitlementsData };
}

function listZipEntries(zipPath: string): Promise<Entry[]> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err: Error | null, zipfile?: ZipFile) => {
      if (err || !zipfile) return reject(err || new Error("Failed to open ZIP"));
      const entries: Entry[] = [];
      zipfile.readEntry();
      zipfile.on("entry", (entry: Entry) => {
        entries.push(entry);
        zipfile.readEntry();
      });
      zipfile.on("end", () => resolve(entries));
      zipfile.on("error", reject);
    });
  });
}

function extractFileFromZip(zipPath: string, fileName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err: Error | null, zipfile?: ZipFile) => {
      if (err || !zipfile) return reject(err || new Error("Failed to open ZIP"));
      zipfile.readEntry();
      zipfile.on("entry", (entry: Entry) => {
        if (entry.fileName === fileName) {
          zipfile.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr || !readStream) return reject(streamErr || new Error("Failed to open stream"));
            const chunks: Buffer[] = [];
            readStream.on("data", (chunk: Buffer) => chunks.push(chunk));
            readStream.on("end", () => resolve(Buffer.concat(chunks)));
            readStream.on("error", reject);
          });
        } else {
          zipfile.readEntry();
        }
      });
      zipfile.on("end", () => reject(new Error(`File not found in ZIP: ${fileName}`)));
      zipfile.on("error", reject);
    });
  });
}
