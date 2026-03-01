import type { Client as TdlClient } from "tdl";
import { prisma } from "../db";
import { logger } from "../logger";

/**
 * Scan a Telegram channel for IPA files.
 * Tracks progress in channel_progress to resume from the last scanned message.
 */
export async function scanChannel(
  client: TdlClient,
  channelId: string
): Promise<{ newMessages: number; ipaMessages: number }> {
  let newMessages = 0;
  let ipaMessages = 0;

  // Get or create channel progress
  let progress = await prisma.channelProgress.findUnique({
    where: { channelId },
  });

  if (!progress) {
    progress = await prisma.channelProgress.create({
      data: { channelId, channelName: channelId },
    });
  }

  try {
    // Resolve the channel
    const chat = await client.invoke({
      _: "searchPublicChat",
      username: channelId.replace("@", ""),
    });

    if (!chat || chat._ !== "chat") {
      await logger.warn("scan", `Channel not found: ${channelId}`);
      return { newMessages: 0, ipaMessages: 0 };
    }

    // Get channel message history starting from last known position
    let fromMessageId = progress.lastMessageId;
    let hasMore = true;

    while (hasMore) {
      const history = (await client.invoke({
        _: "getChatHistory",
        chat_id: chat.id,
        from_message_id: fromMessageId,
        offset: 0,
        limit: 100,
        only_local: false,
      })) as { messages?: Array<{ id: number; content: { _: string; document?: { file_name?: string; document?: { size?: number; id?: number } } } }> };

      const messages = history.messages || [];
      if (messages.length === 0) {
        hasMore = false;
        break;
      }

      for (const msg of messages) {
        // Skip already processed
        const existing = await prisma.processedMessage.findUnique({
          where: {
            channelId_messageId: {
              channelId,
              messageId: msg.id,
            },
          },
        });

        if (existing) continue;

        newMessages++;

        // Check if message has a document attachment that's an IPA
        const hasIpa =
          msg.content?._ === "messageDocument" &&
          msg.content.document?.file_name?.toLowerCase().endsWith(".ipa");

        if (hasIpa) {
          ipaMessages++;
          await prisma.processedMessage.create({
            data: {
              channelId,
              messageId: msg.id,
              hasIpa: true,
              fileName: msg.content.document!.file_name!,
              fileSize: BigInt(msg.content.document!.document?.size || 0),
              status: "pending",
            },
          });
        } else {
          await prisma.processedMessage.create({
            data: {
              channelId,
              messageId: msg.id,
              hasIpa: false,
              status: "skipped",
            },
          });
        }
      }

      // Update progress
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) {
        fromMessageId = lastMsg.id;
      }
      hasMore = messages.length === 100; // More pages if we got a full batch
    }

    // Update channel progress
    await prisma.channelProgress.update({
      where: { channelId },
      data: {
        lastMessageId: fromMessageId,
        totalMessages: { increment: newMessages },
        ipaCount: { increment: ipaMessages },
        lastScannedAt: new Date(),
      },
    });

    await logger.success("scan", `Scanned ${channelId}: ${newMessages} new messages, ${ipaMessages} IPAs found`);
  } catch (e) {
    await logger.error("scan", `Failed to scan ${channelId}`, {
      error: String(e),
    });
  }

  return { newMessages, ipaMessages };
}
