import type { Client as TdlClient } from "tdl";
import { prisma } from "../db";
import { logger } from "../logger";
import { resolveChannelInfo } from "./channel-info";
import { parseForumTopics } from "./forum-topics";

interface CollectedMessage {
  channelId: string;
  messageId: number;
  hasIpa: boolean;
  fileName?: string;
  fileSize?: bigint;
  messageText?: string | null;
  status: string;
}

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

    // Update channel name, description, and forum topics from Telegram
    await resolveChannelInfo(channelId);

    // Reload progress to get updated forum topic data
    progress = await prisma.channelProgress.findUnique({
      where: { channelId },
    });
    if (!progress) return { newMessages: 0, ipaMessages: 0 };

    // Build set of disabled topic IDs for forum channels
    const disabledTopicIds = new Set<number>();
    if (progress.isForum) {
      for (const t of parseForumTopics(progress.forumTopics)) {
        if (!t.enabled) disabledTopicIds.add(t.id);
      }
    }

    // Phase 1: Scan all messages and collect results in memory.
    // We scan up to messageLimit new messages (or the entire history)
    // before writing anything to the database.
    let fromMessageId = 0;
    let hasMore = true;
    let totalScanned = 0;
    const collectedMessages: CollectedMessage[] = [];

    while (hasMore) {
      const fetchLimit = 100;

      const history = (await client.invoke({
        _: "getChatHistory",
        chat_id: chat.id,
        from_message_id: fromMessageId,
        offset: 0,
        limit: fetchLimit,
        only_local: false,
      })) as { messages?: Array<{ id: number; message_thread_id?: number; content: { _: string; document?: { file_name?: string; document?: { size?: number; id?: number } }; caption?: { text?: string } } }> };

      const messages = history.messages || [];
      if (messages.length === 0) {
        hasMore = false;
        break;
      }

      for (const msg of messages) {
        // Check if already processed — skip without early termination
        const existing = await prisma.processedMessage.findUnique({
          where: {
            channelId_messageId: {
              channelId,
              messageId: msg.id,
            },
          },
        });

        if (existing) continue;

        // Skip messages from disabled forum topics (don't count toward scan limit)
        if (
          disabledTopicIds.size > 0 &&
          msg.message_thread_id &&
          disabledTopicIds.has(msg.message_thread_id)
        ) {
          collectedMessages.push({
            channelId,
            messageId: msg.id,
            hasIpa: false,
            status: "skipped",
          });
          continue;
        }

        totalScanned++;
        newMessages++;

        // Check if message has a document attachment that's an IPA
        const hasIpa =
          msg.content?._ === "messageDocument" &&
          msg.content.document?.file_name?.toLowerCase().endsWith(".ipa");

        if (hasIpa) {
          ipaMessages++;
          collectedMessages.push({
            channelId,
            messageId: msg.id,
            hasIpa: true,
            fileName: msg.content.document!.file_name!,
            fileSize: BigInt(msg.content.document!.document?.size || 0),
            messageText: msg.content.caption?.text || null,
            status: "pending",
          });
        } else {
          collectedMessages.push({
            channelId,
            messageId: msg.id,
            hasIpa: false,
            status: "skipped",
          });
        }
      }

      // Update pagination cursor
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) {
        fromMessageId = lastMsg.id;
      }
      // Stop if Telegram returned a partial batch (end of history)
      if (messages.length < fetchLimit) hasMore = false;
      // Stop if we've hit the message limit
      if (messageLimit > 0 && totalScanned >= messageLimit) hasMore = false;
    }

    // Phase 2: Batch-write all collected messages to the database
    if (collectedMessages.length > 0) {
      await prisma.processedMessage.createMany({
        data: collectedMessages.map((m) => ({
          channelId: m.channelId,
          messageId: m.messageId,
          hasIpa: m.hasIpa,
          fileName: m.fileName ?? null,
          fileSize: m.fileSize ?? null,
          messageText: m.messageText ?? null,
          status: m.status,
        })),
        skipDuplicates: true,
      });
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

/**
 * Scan a Telegram channel backwards until a target number of NEW (unprocessed)
 * IPAs have been found. Already-processed IPAs do not count toward the target,
 * ensuring the scan goes deep enough to discover genuinely new content.
 */
export async function scanChannelPrevious(
  client: TdlClient,
  channelId: string,
  ipaTarget: number
): Promise<{ newMessages: number; ipaMessages: number }> {
  let newMessages = 0;
  let ipaMessages = 0;

  let progress = await prisma.channelProgress.findUnique({
    where: { channelId },
  });

  if (!progress) {
    progress = await prisma.channelProgress.create({
      data: { channelId, channelName: channelId },
    });
  }

  try {
    const chat = await client.invoke({
      _: "searchPublicChat",
      username: channelId.replace("@", ""),
    });

    if (!chat || chat._ !== "chat") {
      await logger.warn("scan", `Channel not found: ${channelId}`);
      return { newMessages: 0, ipaMessages: 0 };
    }

    await resolveChannelInfo(channelId);

    progress = await prisma.channelProgress.findUnique({
      where: { channelId },
    });
    if (!progress) return { newMessages: 0, ipaMessages: 0 };

    const disabledTopicIds = new Set<number>();
    if (progress.isForum) {
      for (const t of parseForumTopics(progress.forumTopics)) {
        if (!t.enabled) disabledTopicIds.add(t.id);
      }
    }

    let fromMessageId = 0;
    let hasMore = true;
    let ipasSeen = 0; // counts only NEW (unprocessed) IPAs found
    const collectedMessages: CollectedMessage[] = [];

    while (hasMore) {
      const fetchLimit = 100;

      const history = (await client.invoke({
        _: "getChatHistory",
        chat_id: chat.id,
        from_message_id: fromMessageId,
        offset: 0,
        limit: fetchLimit,
        only_local: false,
      })) as { messages?: Array<{ id: number; message_thread_id?: number; content: { _: string; document?: { file_name?: string; document?: { size?: number; id?: number } }; caption?: { text?: string } } }> };

      const messages = history.messages || [];
      if (messages.length === 0) {
        hasMore = false;
        break;
      }

      for (const msg of messages) {
        const hasIpa =
          msg.content?._ === "messageDocument" &&
          msg.content.document?.file_name?.toLowerCase().endsWith(".ipa");

        // Skip disabled forum topics
        if (
          disabledTopicIds.size > 0 &&
          msg.message_thread_id &&
          disabledTopicIds.has(msg.message_thread_id)
        ) {
          const existing = await prisma.processedMessage.findUnique({
            where: { channelId_messageId: { channelId, messageId: msg.id } },
          });
          if (!existing) {
            collectedMessages.push({
              channelId,
              messageId: msg.id,
              hasIpa: false,
              status: "skipped",
            });
          }
          continue;
        }

        // Check if already processed — skip entirely
        const existing = await prisma.processedMessage.findUnique({
          where: { channelId_messageId: { channelId, messageId: msg.id } },
        });
        if (existing) continue;

        newMessages++;

        if (hasIpa) {
          ipaMessages++;
          ipasSeen++; // Only count NEW IPAs toward the target
          collectedMessages.push({
            channelId,
            messageId: msg.id,
            hasIpa: true,
            fileName: msg.content.document!.file_name!,
            fileSize: BigInt(msg.content.document!.document?.size || 0),
            messageText: msg.content.caption?.text || null,
            status: "pending",
          });
        } else {
          collectedMessages.push({
            channelId,
            messageId: msg.id,
            hasIpa: false,
            status: "skipped",
          });
        }

        // Stop once we've found enough NEW IPAs
        if (ipaTarget > 0 && ipasSeen >= ipaTarget) {
          hasMore = false;
          break;
        }
      }

      const lastMsg = messages[messages.length - 1];
      if (lastMsg) fromMessageId = lastMsg.id;
      if (messages.length < fetchLimit) hasMore = false;
      if (ipaTarget > 0 && ipasSeen >= ipaTarget) hasMore = false;
    }

    // Batch-write all collected messages to the database
    if (collectedMessages.length > 0) {
      await prisma.processedMessage.createMany({
        data: collectedMessages.map((m) => ({
          channelId: m.channelId,
          messageId: m.messageId,
          hasIpa: m.hasIpa,
          fileName: m.fileName ?? null,
          fileSize: m.fileSize ?? null,
          messageText: m.messageText ?? null,
          status: m.status,
        })),
        skipDuplicates: true,
      });
    }

    await prisma.channelProgress.update({
      where: { channelId },
      data: {
        lastMessageId: fromMessageId,
        totalMessages: { increment: newMessages },
        ipaCount: { increment: ipaMessages },
        lastScannedAt: new Date(),
      },
    });

    await logger.success(
      "scan",
      `Scan Previous ${channelId}: ${newMessages} new messages, ${ipaMessages} new IPAs found (scanned until ${ipasSeen} IPAs seen)`
    );
  } catch (e) {
    await logger.error("scan", `Failed to scan previous ${channelId}`, {
      error: String(e),
    });
  }

  return { newMessages, ipaMessages };
}
