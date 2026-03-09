import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import type { Client as TdlClient } from "tdl";
import { fetchForumTopics, mergeTopics, parseForumTopics } from "./forum-topics";

/**
 * Resolve a Telegram channel's title and description, then update the DB.
 * Also detects forum channels and fetches/merges forum topics.
 * Best-effort — silently returns if Telegram isn't connected.
 */
export async function resolveChannelInfo(
  channelId: string,
  telegramClient: TdlClient
): Promise<void> {
  const chat = await telegramClient.invoke({
    _: "searchPublicChat",
    username: channelId.replace("@", ""),
  });

  if (!chat || chat._ !== "chat") return;

  const updateData: {
    channelName?: string;
    channelDescription?: string;
    isForum?: boolean;
    forumTopics?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  } = {};
  const chatTitle = (chat as { title?: string }).title;
  if (chatTitle) updateData.channelName = chatTitle;

  try {
    const chatType = chat as { type?: { _: string; supergroup_id?: number } };
    if (chatType.type?._ === "chatTypeSupergroup" && chatType.type.supergroup_id) {
      const supergroupId = chatType.type.supergroup_id;

      const fullInfo = await telegramClient.invoke({
        _: "getSupergroupFullInfo",
        supergroup_id: supergroupId,
      });
      const desc = (fullInfo as { description?: string }).description;
      if (desc) updateData.channelDescription = desc;

      const supergroup = (await telegramClient.invoke({
        _: "getSupergroup",
        supergroup_id: supergroupId,
      })) as { is_forum?: boolean };

      const isForum = supergroup.is_forum === true;
      updateData.isForum = isForum;

      if (isForum) {
        const chatId = (chat as { id?: number }).id;
        if (chatId) {
          const fetched = await fetchForumTopics(telegramClient, chatId);
          const existing = await prisma.channelProgress.findUnique({
            where: { channelId },
            select: { forumTopics: true },
          });
          const existingTopics = parseForumTopics(existing?.forumTopics);
          updateData.forumTopics =
            mergeTopics(existingTopics, fetched) as unknown as Prisma.InputJsonValue;
        }
      } else {
        updateData.forumTopics = Prisma.JsonNull;
      }
    }
  } catch {
    // Description/forum fetch is best-effort.
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.channelProgress.update({
      where: { channelId },
      data: updateData,
    });
  }
}
