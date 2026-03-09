import type { Client as TdlClient } from "tdl";

export interface ForumTopic {
  id: number;
  name: string;
  iconColor: number;
  enabled: boolean;
}

/**
 * Fetch all forum topics for a supergroup chat via TDLib pagination.
 */
export async function fetchForumTopics(
  client: TdlClient,
  chatId: number
): Promise<ForumTopic[]> {
  const topics: ForumTopic[] = [];
  let offsetDate = 0;
  let offsetMessageId = 0;
  let offsetMessageThreadId = 0;

  while (true) {
    const result = (await client.invoke({
      _: "getForumTopics",
      chat_id: chatId,
      query: "",
      offset_date: offsetDate,
      offset_message_id: offsetMessageId,
      offset_message_thread_id: offsetMessageThreadId,
      limit: 100,
    })) as {
      _: string;
      topics?: Array<{
        info?: {
          message_thread_id?: number;
          name?: string;
          icon?: { color?: number };
        };
      }>;
      next_offset_date?: number;
      next_offset_message_id?: number;
      next_offset_message_thread_id?: number;
    };

    if (!result.topics || result.topics.length === 0) break;

    for (const t of result.topics) {
      if (t.info?.message_thread_id) {
        topics.push({
          id: t.info.message_thread_id,
          name: t.info.name || "Untitled",
          iconColor: t.info.icon?.color ?? 0,
          enabled: true,
        });
      }
    }

    // Check if there are more pages
    if (
      !result.next_offset_date &&
      !result.next_offset_message_id &&
      !result.next_offset_message_thread_id
    ) {
      break;
    }

    offsetDate = result.next_offset_date ?? 0;
    offsetMessageId = result.next_offset_message_id ?? 0;
    offsetMessageThreadId = result.next_offset_message_thread_id ?? 0;
  }

  return topics;
}

/**
 * Parse the JSON column back to a typed ForumTopic array.
 */
export function parseForumTopics(json: unknown): ForumTopic[] {
  if (!json || !Array.isArray(json)) return [];
  return json.map((t) => ({
    id: Number(t.id),
    name: String(t.name || "Untitled"),
    iconColor: Number(t.iconColor ?? 0),
    enabled: t.enabled !== false,
  }));
}

/**
 * Merge fetched topics with existing ones, preserving user's enabled/disabled choices.
 * New topics default to enabled.
 */
export function mergeTopics(
  existing: ForumTopic[],
  fetched: ForumTopic[]
): ForumTopic[] {
  const existingMap = new Map(existing.map((t) => [t.id, t]));

  return fetched.map((t) => {
    const prev = existingMap.get(t.id);
    return {
      ...t,
      enabled: prev ? prev.enabled : true,
    };
  });
}
