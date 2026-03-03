import { prisma } from "../db";
import { getTelegramClient } from "./client";

/**
 * Resolve a Telegram channel's title and description, then update the DB.
 * Best-effort — silently returns if Telegram isn't connected.
 */
export async function resolveChannelInfo(channelId: string): Promise<void> {
  let client;
  try {
    client = await getTelegramClient();
  } catch {
    return; // Telegram not connected
  }

  try {
    const chat = await client.invoke({
      _: "searchPublicChat",
      username: channelId.replace("@", ""),
    });

    if (!chat || chat._ !== "chat") return;

    const updateData: { channelName?: string; channelDescription?: string } = {};
    const chatTitle = (chat as { title?: string }).title;
    if (chatTitle) updateData.channelName = chatTitle;

    try {
      const chatType = chat as { type?: { _: string; supergroup_id?: number } };
      if (chatType.type?._ === "chatTypeSupergroup" && chatType.type.supergroup_id) {
        const fullInfo = await client.invoke({
          _: "getSupergroupFullInfo",
          supergroup_id: chatType.type.supergroup_id,
        });
        const desc = (fullInfo as { description?: string }).description;
        if (desc) updateData.channelDescription = desc;
      }
    } catch {
      // Description fetch is best-effort
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.channelProgress.update({
        where: { channelId },
        data: updateData,
      });
    }
  } catch {
    // Channel resolution is best-effort
  }
}
