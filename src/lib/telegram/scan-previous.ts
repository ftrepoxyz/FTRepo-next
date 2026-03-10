export interface TelegramHistoryMessage {
  id: number;
  message_thread_id?: number;
  content: {
    _: string;
    document?: {
      file_name?: string;
      document?: {
        size?: number;
        id?: number;
      };
    };
    caption?: {
      text?: string;
    };
  };
}

export interface PreviousScanCollectedMessage {
  channelId: string;
  messageId: number;
  hasIpa: boolean;
  fileName?: string;
  fileSize?: bigint;
  messageText?: string | null;
  status: string;
}

interface ProcessPreviousScanBatchOptions {
  channelId: string;
  messages: TelegramHistoryMessage[];
  processedMessageIds: Set<number>;
  disabledTopicIds: Set<number>;
  ipaTarget: number;
  ipasSeen: number;
}

export interface ProcessPreviousScanBatchResult {
  collectedMessages: PreviousScanCollectedMessage[];
  nextCursor: number;
  ipasSeen: number;
  newMessages: number;
  ipaMessages: number;
  shouldStop: boolean;
}

export function processPreviousScanBatch({
  channelId,
  messages,
  processedMessageIds,
  disabledTopicIds,
  ipaTarget,
  ipasSeen,
}: ProcessPreviousScanBatchOptions): ProcessPreviousScanBatchResult {
  const collectedMessages: PreviousScanCollectedMessage[] = [];
  let nextCursor = 0;
  let nextIpasSeen = ipasSeen;
  let newMessages = 0;
  let ipaMessages = 0;

  for (const msg of messages) {
    nextCursor = msg.id;

    const hasIpa =
      msg.content?._ === "messageDocument" &&
      msg.content.document?.file_name?.toLowerCase().endsWith(".ipa");

    if (
      disabledTopicIds.size > 0 &&
      msg.message_thread_id &&
      disabledTopicIds.has(msg.message_thread_id)
    ) {
      if (!processedMessageIds.has(msg.id)) {
        collectedMessages.push({
          channelId,
          messageId: msg.id,
          hasIpa: false,
          status: "skipped",
        });
      }
      continue;
    }

    if (processedMessageIds.has(msg.id)) {
      continue;
    }

    newMessages++;

    if (hasIpa) {
      ipaMessages++;
      nextIpasSeen++;
      collectedMessages.push({
        channelId,
        messageId: msg.id,
        hasIpa: true,
        fileName: msg.content.document?.file_name,
        fileSize: BigInt(msg.content.document?.document?.size || 0),
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

    if (ipaTarget > 0 && nextIpasSeen >= ipaTarget) {
      return {
        collectedMessages,
        nextCursor,
        ipasSeen: nextIpasSeen,
        newMessages,
        ipaMessages,
        shouldStop: true,
      };
    }
  }

  return {
    collectedMessages,
    nextCursor,
    ipasSeen: nextIpasSeen,
    newMessages,
    ipaMessages,
    shouldStop: false,
  };
}
