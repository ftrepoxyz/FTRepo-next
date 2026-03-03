import { prisma } from "../db";
import { logger } from "../logger";

export interface QueueEntry {
  id: number;
  channelId: string;
  messageId: number; // converted from BigInt for TDLib compat
  fileName: string;
  fileSize: bigint;
  messageText: string | null;
}

/**
 * Claim the next pending IPA from the queue using a Prisma transaction
 * to prevent race conditions between workers.
 */
export async function claimNextPending(): Promise<QueueEntry | null> {
  return prisma.$transaction(async (tx) => {
    const pending = await tx.processedMessage.findFirst({
      where: { status: "pending", hasIpa: true },
      orderBy: { createdAt: "asc" },
    });

    if (!pending) return null;

    await tx.processedMessage.update({
      where: { id: pending.id },
      data: { status: "downloading" },
    });

    return {
      id: pending.id,
      channelId: pending.channelId,
      messageId: Number(pending.messageId),
      fileName: pending.fileName || "unknown.ipa",
      fileSize: pending.fileSize || BigInt(0),
      messageText: pending.messageText || null,
    };
  });
}

/**
 * Mark a queue entry as completed.
 */
export async function markCompleted(id: number): Promise<void> {
  await prisma.processedMessage.update({
    where: { id },
    data: { status: "completed", updatedAt: new Date() },
  });
}

/**
 * Mark a queue entry as failed with an error message.
 */
export async function markFailed(id: number, error: string): Promise<void> {
  await prisma.processedMessage.update({
    where: { id },
    data: { status: "failed", error, updatedAt: new Date() },
  });
  await logger.error("process", `Queue item ${id} failed: ${error}`);
}

/**
 * Retry a failed queue entry.
 */
export async function retryFailed(id: number): Promise<void> {
  await prisma.processedMessage.update({
    where: { id },
    data: { status: "pending", error: null, updatedAt: new Date() },
  });
}

/**
 * Retry all failed entries.
 */
export async function retryAllFailed(): Promise<number> {
  const result = await prisma.processedMessage.updateMany({
    where: { status: "failed" },
    data: { status: "pending", error: null },
  });
  return result.count;
}

/**
 * Get queue statistics.
 */
export async function getQueueStats(): Promise<{
  pending: number;
  downloading: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  const [pending, downloading, processing, completed, failed] =
    await Promise.all([
      prisma.processedMessage.count({ where: { status: "pending", hasIpa: true } }),
      prisma.processedMessage.count({ where: { status: "downloading" } }),
      prisma.processedMessage.count({ where: { status: "processing" } }),
      prisma.processedMessage.count({ where: { status: "completed" } }),
      prisma.processedMessage.count({ where: { status: "failed" } }),
    ]);

  return { pending, downloading, processing, completed, failed };
}
