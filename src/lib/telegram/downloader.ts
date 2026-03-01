import type { Client as TdlClient } from "tdl";
import { mkdirSync, existsSync } from "fs";
import { getConfig } from "../config";
import { logger } from "../logger";

const MAX_CONCURRENT_DOWNLOADS = 3;
let activeDownloads = 0;

/**
 * Download a file from Telegram by its file ID.
 * Returns the local path where the file was saved.
 */
export async function downloadFile(
  client: TdlClient,
  fileId: number,
  fileName: string
): Promise<string> {
  const tempDir = getConfig().env.TEMP_DIR;
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  // Wait for download slot
  while (activeDownloads >= MAX_CONCURRENT_DOWNLOADS) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  activeDownloads++;
  try {
    const result = (await client.invoke({
      _: "downloadFile",
      file_id: fileId,
      priority: 32,
      offset: 0,
      limit: 0,
      synchronous: true,
    })) as { local?: { path?: string } };

    const remotePath = result.local?.path;
    if (!remotePath) {
      throw new Error("Download returned no local path");
    }

    await logger.success("download", `Downloaded ${fileName}`, {
      path: remotePath,
    });

    return remotePath;
  } finally {
    activeDownloads--;
  }
}

/**
 * Download an IPA file for a specific channel message.
 */
export async function downloadIpaFromMessage(
  client: TdlClient,
  chatId: number,
  messageId: number
): Promise<string | null> {
  try {
    const message = (await client.invoke({
      _: "getMessage",
      chat_id: chatId,
      message_id: messageId,
    })) as {
      content?: {
        _: string;
        document?: {
          file_name?: string;
          document?: { id?: number };
        };
      };
    };

    if (
      message.content?._ !== "messageDocument" ||
      !message.content.document?.document?.id
    ) {
      return null;
    }

    const fileId = message.content.document.document.id;
    const fileName = message.content.document.file_name || "unknown.ipa";

    return await downloadFile(client, fileId, fileName);
  } catch (e) {
    await logger.error("download", `Failed to download message ${messageId}`, {
      error: String(e),
    });
    return null;
  }
}
