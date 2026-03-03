import type { Client as TdlClient } from "tdl";
import { prisma } from "../db";
import { logger } from "../logger";
import { resolveChannelInfo } from "./channel-info";

/**
 * Scan a Telegram channel for IPA files.
 * Tracks progress in channel_progress to resume from the last scanned message.
 */
export async function scanChannel(
  client: TdlClient,
  channelId: string,
  messageLimit: number = 0
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

    // Update channel name and description from Telegram
    await resolveChannelInfo(channelId);

    // Get channel message history starting from last known position
    let fromMessageId = Number(progress.lastMessageId);
    let hasMore = true;
    let totalScanned = 0;
    const batchSize = messageLimit > 0 ? Math.min(100, messageLimit) : 100;

    while (hasMore) {
      const fetchLimit = messageLimit > 0 ? Math.min(batchSize, messageLimit - totalScanned) : 100;
      if (messageLimit > 0 && fetchLimit <= 0) break;

      const history = (await client.invoke({
        _: "getChatHistory",
        chat_id: chat.id,
        from_message_id: fromMessageId,
        offset: 0,
        limit: fetchLimit,
        only_local: false,
      })) as { messages?: Array<{ id: number; content: { _: string; document?: { file_name?: string; document?: { size?: number; id?: number } }; caption?: { text?: string } } }> };

      const messages = history.messages || [];
      if (messages.length === 0) {
        hasMore = false;
        break;
      }

      totalScanned += messages.length;

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
              messageText: msg.content.caption?.text || null,
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
      hasMore = messages.length === fetchLimit; // More pages if we got a full batch
      if (messageLimit > 0 && totalScanned >= messageLimit) hasMore = false;
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
