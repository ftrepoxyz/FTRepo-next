import { prisma } from "../db";
import { logger } from "../logger";
import { getSettings, getTelegramChannels } from "../config";
import { getVariantMeta } from "../json/grouping";
import { processPendingIpaById } from "../pipeline/orchestrator";
import { parseForumTopics } from "./forum-topics";
import { resolveChannelInfo } from "./channel-info";
import type { TweakConfig } from "@/types/config";
import type { DownloadedIpa } from "@prisma/client";
import type { Client as TdlClient } from "tdl";
import type { TelegramHistoryMessage } from "./scan-previous";

const TELEGRAM_HISTORY_BATCH_SIZE = 100;

type SearchIpaMode = "known_tweak" | "generic";

type SearchProgressCallback = (progress: {
  label: string;
  current: number;
  total: number;
}) => Promise<void> | void;

export interface SearchIpaResolution {
  mode: SearchIpaMode;
  query: string;
  normalizedQuery: string;
  resolvedTweakName: string | null;
  lockedChannelId: string | null;
  searchTerms: string[];
}

export interface SearchIpaCandidate {
  channelId: string;
  messageId: number;
  fileName: string;
  fileSize: bigint;
  messageText: string | null;
}

export interface SearchIpaCommandResult {
  outcome: "completed" | "partial" | "not_found";
  query: string;
  mode: SearchIpaMode;
  resolvedTweakName: string | null;
  lockedChannelId: string | null;
  targetVersions: number;
  distinctVersionsPresent: number;
  importedCount: number;
  alreadyPresentCount: number;
  failedCount: number;
  searchedChannels: string[];
  groupKey: string | null;
  batchesScanned: number;
  totalMessagesExamined: number;
  ipaFilesSeenInChannel: number;
  searchTerms: string[];
}

type CandidateImportResult = {
  processedMessageId: number;
  finalStatus: string;
  processedNow: boolean;
  downloadedIpa: DownloadedIpa | null;
  error: string | null;
};

type ChatHistoryResponse = {
  messages?: TelegramHistoryMessage[];
};

function getMatchNames(tweak: TweakConfig): string[] {
  return [tweak.name, ...(tweak.aliases || [])];
}

function getSpecificityScore(tweak: TweakConfig): number {
  return Math.max(...getMatchNames(tweak).map((name) => normalizeIpaSearchTerm(name).length));
}

export function normalizeIpaSearchTerm(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\.ipa$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueTerms(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => normalizeIpaSearchTerm(value)).filter(Boolean))
  );
}

function compactSearchTerm(value: string): string {
  return normalizeIpaSearchTerm(value).replace(/\s+/g, "");
}

function sortTweaksBySpecificity(tweaks: TweakConfig[]): TweakConfig[] {
  return [...tweaks].sort((a, b) => getSpecificityScore(b) - getSpecificityScore(a));
}

export function resolveSearchIpaQuery(
  query: string,
  knownTweaks: TweakConfig[]
): SearchIpaResolution {
  const normalizedQuery = normalizeIpaSearchTerm(query);

  if (!normalizedQuery) {
    return {
      mode: "generic",
      query,
      normalizedQuery,
      resolvedTweakName: null,
      lockedChannelId: null,
      searchTerms: [],
    };
  }

  const sortedTweaks = sortTweaksBySpecificity(knownTweaks);

  const exactMatch = sortedTweaks.find((tweak) =>
    getMatchNames(tweak).some(
      (name) => normalizeIpaSearchTerm(name) === normalizedQuery
    )
  );

  if (exactMatch) {
    return {
      mode: "known_tweak",
      query,
      normalizedQuery,
      resolvedTweakName: exactMatch.name,
      lockedChannelId: exactMatch.lockedChannelId ?? null,
      searchTerms: uniqueTerms([...getMatchNames(exactMatch), query]),
    };
  }

  const substringMatch = sortedTweaks.find((tweak) =>
    getMatchNames(tweak).some((name) => {
      const normalizedName = normalizeIpaSearchTerm(name);
      return (
        normalizedName.includes(normalizedQuery) ||
        normalizedQuery.includes(normalizedName)
      );
    })
  );

  if (substringMatch) {
    return {
      mode: "known_tweak",
      query,
      normalizedQuery,
      resolvedTweakName: substringMatch.name,
      lockedChannelId: substringMatch.lockedChannelId ?? null,
      searchTerms: uniqueTerms([...getMatchNames(substringMatch), query]),
    };
  }

  return {
    mode: "generic",
    query,
    normalizedQuery,
    resolvedTweakName: null,
    lockedChannelId: null,
    searchTerms: [normalizedQuery],
  };
}

function isIpaMessage(message: TelegramHistoryMessage): boolean {
  return (
    message.content?._ === "messageDocument" &&
    Boolean(message.content.document?.file_name?.toLowerCase().endsWith(".ipa"))
  );
}

function fileNameMatchesSearchTerms(
  fileName: string | undefined,
  searchTerms: string[]
): boolean {
  if (!fileName) return false;
  const normalizedFileName = normalizeIpaSearchTerm(fileName);
  const compactFileName = compactSearchTerm(fileName);
  if (!normalizedFileName) return false;

  return searchTerms.some((term) => {
    const normalizedTerm = normalizeIpaSearchTerm(term);
    if (!normalizedTerm) {
      return false;
    }

    return (
      normalizedFileName.includes(normalizedTerm) ||
      compactFileName.includes(compactSearchTerm(normalizedTerm))
    );
  });
}

export function collectMatchingIpaCandidates(params: {
  channelId: string;
  messages: TelegramHistoryMessage[];
  disabledTopicIds: Set<number>;
  searchTerms: string[];
}): SearchIpaCandidate[] {
  const { channelId, messages, disabledTopicIds, searchTerms } = params;
  const candidates: SearchIpaCandidate[] = [];

  for (const message of messages) {
    if (
      disabledTopicIds.size > 0 &&
      message.message_thread_id &&
      disabledTopicIds.has(message.message_thread_id)
    ) {
      continue;
    }

    if (!isIpaMessage(message)) {
      continue;
    }

    const fileName = message.content.document?.file_name;
    if (!fileNameMatchesSearchTerms(fileName, searchTerms)) {
      continue;
    }
    if (!fileName) {
      continue;
    }

    candidates.push({
      channelId,
      messageId: message.id,
      fileName,
      fileSize: BigInt(message.content.document?.document?.size || 0),
      messageText: message.content.caption?.text || null,
    });
  }

  return candidates;
}

function buildProgressLabel(params: {
  mode: SearchIpaMode;
  resolvedTweakName: string | null;
  channelId: string;
  channelIndex: number;
  totalChannels: number;
  distinctVersionsPresent: number;
  targetVersions: number;
  batchesScanned: number;
}): string {
  const { mode, resolvedTweakName, channelId, channelIndex, totalChannels, distinctVersionsPresent, targetVersions, batchesScanned } =
    params;
  const modeLabel =
    mode === "known_tweak" && resolvedTweakName
      ? `Known tweak: ${resolvedTweakName}`
      : "Generic search";

  return `${modeLabel} | ${channelId} (${channelIndex}/${totalChannels}) | ${distinctVersionsPresent}/${targetVersions} version(s) ready | ${batchesScanned} batch(es) scanned`;
}

async function ensureChannelProgress(channelId: string): Promise<void> {
  const existing = await prisma.channelProgress.findUnique({
    where: { channelId },
    select: { id: true },
  });

  if (existing) {
    return;
  }

  await prisma.channelProgress.create({
    data: {
      channelId,
      channelName: channelId,
    },
  });
}

async function getDisabledTopicIds(
  channelId: string,
  client: TdlClient
): Promise<Set<number>> {
  await ensureChannelProgress(channelId);
  await resolveChannelInfo(channelId, client);

  const progress = await prisma.channelProgress.findUnique({
    where: { channelId },
    select: {
      isForum: true,
      forumTopics: true,
    },
  });

  const disabledTopicIds = new Set<number>();
  if (!progress?.isForum) {
    return disabledTopicIds;
  }

  for (const topic of parseForumTopics(progress.forumTopics)) {
    if (!topic.enabled) {
      disabledTopicIds.add(topic.id);
    }
  }

  return disabledTopicIds;
}

async function resolveChat(
  channelId: string,
  client: TdlClient,
  chatIdMap: Map<string, number>
): Promise<{ id: number } | null> {
  const cachedId = chatIdMap.get(channelId);
  if (cachedId) {
    return { id: cachedId };
  }

  const chat = (await client.invoke({
    _: "searchPublicChat",
    username: channelId.replace("@", ""),
  })) as { _: string; id?: number } | null;

  if (!chat || chat._ !== "chat" || !chat.id) {
    return null;
  }

  chatIdMap.set(channelId, chat.id);
  return { id: chat.id };
}

async function getDownloadedIpaBySource(
  channelId: string,
  messageId: number
): Promise<DownloadedIpa | null> {
  return prisma.downloadedIpa.findFirst({
    where: {
      channelId,
      messageId: BigInt(messageId),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

async function createPendingProcessedMessage(candidate: SearchIpaCandidate) {
  return prisma.processedMessage.create({
    data: {
      channelId: candidate.channelId,
      messageId: BigInt(candidate.messageId),
      hasIpa: true,
      fileName: candidate.fileName,
      fileSize: candidate.fileSize,
      messageText: candidate.messageText,
      status: "pending",
    },
  });
}

async function importSearchCandidate(
  candidate: SearchIpaCandidate,
  client: TdlClient,
  chatIdMap: Map<string, number>
): Promise<CandidateImportResult> {
  let processedMessage = await prisma.processedMessage.findUnique({
    where: {
      channelId_messageId: {
        channelId: candidate.channelId,
        messageId: BigInt(candidate.messageId),
      },
    },
  });

  let downloadedIpa = await getDownloadedIpaBySource(
    candidate.channelId,
    candidate.messageId
  );
  let processedNow = false;

  if (!processedMessage) {
    processedMessage = await createPendingProcessedMessage(candidate);
  } else if (processedMessage.status === "completed" && !downloadedIpa) {
    processedMessage = await prisma.processedMessage.update({
      where: { id: processedMessage.id },
      data: {
        status: "pending",
        error: null,
      },
    });
  }

  if (processedMessage.status === "pending" || processedMessage.status === "failed") {
    processedNow = true;
    await processPendingIpaById(processedMessage.id, chatIdMap, client);
    processedMessage = await prisma.processedMessage.findUniqueOrThrow({
      where: { id: processedMessage.id },
    });
    downloadedIpa = await getDownloadedIpaBySource(
      candidate.channelId,
      candidate.messageId
    );
  }

  return {
    processedMessageId: processedMessage.id,
    finalStatus: processedMessage.status,
    processedNow,
    downloadedIpa,
    error: processedMessage.error,
  };
}

async function getDistinctVersionsForGroupKey(
  groupKey: string,
  knownTweaks: TweakConfig[]
): Promise<Set<string>> {
  const [bundleId] = groupKey.split("::");
  const ipas = await prisma.downloadedIpa.findMany({
    where: { bundleId },
    orderBy: { createdAt: "desc" },
  });

  const versions = new Set<string>();
  for (const ipa of ipas) {
    const tweaks = Array.isArray(ipa.tweaks) ? (ipa.tweaks as string[]) : [];
    const variant = getVariantMeta(
      ipa.bundleId,
      ipa.appName,
      tweaks,
      ipa.isTweaked,
      knownTweaks,
      ipa.channelId
    );

    if (variant.groupKey === groupKey) {
      versions.add(ipa.version);
    }
  }

  return versions;
}

async function findExistingGroupForKnownTweak(
  tweakName: string,
  lockedChannelId: string | null,
  knownTweaks: TweakConfig[]
): Promise<{ groupKey: string; versions: Set<string> } | null> {
  const ipas = await prisma.downloadedIpa.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const groups = new Map<
    string,
    { versions: Set<string>; latestCreatedAt: number }
  >();

  for (const ipa of ipas) {
    if (lockedChannelId && ipa.channelId !== lockedChannelId) {
      continue;
    }

    const tweaks = Array.isArray(ipa.tweaks) ? (ipa.tweaks as string[]) : [];
    const variant = getVariantMeta(
      ipa.bundleId,
      ipa.appName,
      tweaks,
      ipa.isTweaked,
      knownTweaks,
      ipa.channelId
    );

    if (variant.matchedTweak !== tweakName) {
      continue;
    }

    const existing = groups.get(variant.groupKey);
    if (existing) {
      existing.versions.add(ipa.version);
      existing.latestCreatedAt = Math.max(
        existing.latestCreatedAt,
        ipa.createdAt.getTime()
      );
    } else {
      groups.set(variant.groupKey, {
        versions: new Set([ipa.version]),
        latestCreatedAt: ipa.createdAt.getTime(),
      });
    }
  }

  let bestGroup:
    | { groupKey: string; versions: Set<string>; latestCreatedAt: number }
    | null = null;
  for (const [groupKey, group] of groups) {
    if (
      !bestGroup ||
      group.latestCreatedAt > bestGroup.latestCreatedAt ||
      (group.latestCreatedAt === bestGroup.latestCreatedAt &&
        group.versions.size > bestGroup.versions.size)
    ) {
      bestGroup = { groupKey, ...group };
    }
  }

  if (!bestGroup) {
    return null;
  }

  return {
    groupKey: bestGroup.groupKey,
    versions: bestGroup.versions,
  };
}

export async function searchIpasByName(params: {
  query: string;
  client: TdlClient;
  chatIdMap: Map<string, number>;
  onProgress?: SearchProgressCallback;
}): Promise<SearchIpaCommandResult> {
  const { query, client, chatIdMap, onProgress } = params;
  const settings = await getSettings();
  const resolution = resolveSearchIpaQuery(query, settings.known_tweaks);

  if (!resolution.normalizedQuery || resolution.searchTerms.length === 0) {
    throw new Error("A search query is required.");
  }

  const scopedChannels = resolution.lockedChannelId
    ? [resolution.lockedChannelId]
    : await getTelegramChannels();

  if (scopedChannels.length === 0) {
    throw new Error("No Telegram channels are available for IPA search.");
  }

  const targetVersions = settings.max_versions_per_app;
  let targetGroupKey: string | null = null;
  let distinctVersions = new Set<string>();
  let alreadyPresentCount = 0;
  let importedCount = 0;
  let failedCount = 0;
  let totalBatchesScanned = 0;
  let totalMessagesExamined = 0;
  let totalIpaFilesSeen = 0;
  const searchedChannels: string[] = [];
  const seenCandidates = new Set<string>();

  if (resolution.mode === "known_tweak" && resolution.resolvedTweakName) {
    const existingGroup = await findExistingGroupForKnownTweak(
      resolution.resolvedTweakName,
      resolution.lockedChannelId,
      settings.known_tweaks
    );

    if (existingGroup) {
      targetGroupKey = existingGroup.groupKey;
      distinctVersions = existingGroup.versions;
      alreadyPresentCount = existingGroup.versions.size;
    }
  }

  if (distinctVersions.size >= targetVersions) {
    await logger.info("scan", `IPA search already satisfied for "${query}"`, {
      query,
      mode: resolution.mode,
      resolvedTweakName: resolution.resolvedTweakName,
      lockedChannelId: resolution.lockedChannelId,
      targetVersions,
      distinctVersionsPresent: distinctVersions.size,
    });

    return {
      outcome: "completed",
      query,
      mode: resolution.mode,
      resolvedTweakName: resolution.resolvedTweakName,
      lockedChannelId: resolution.lockedChannelId,
      targetVersions,
      distinctVersionsPresent: distinctVersions.size,
      importedCount,
      alreadyPresentCount,
      failedCount,
      searchedChannels,
      groupKey: targetGroupKey,
      batchesScanned: 0,
      totalMessagesExamined: 0,
      ipaFilesSeenInChannel: 0,
      searchTerms: resolution.searchTerms,
    };
  }

  for (const [channelIndex, channelId] of scopedChannels.entries()) {
    await onProgress?.({
      label: buildProgressLabel({
        mode: resolution.mode,
        resolvedTweakName: resolution.resolvedTweakName,
        channelId,
        channelIndex: channelIndex + 1,
        totalChannels: scopedChannels.length,
        distinctVersionsPresent: distinctVersions.size,
        targetVersions,
        batchesScanned: 0,
      }),
      current: distinctVersions.size,
      total: targetVersions,
    });

    try {
      const chat = await resolveChat(channelId, client, chatIdMap);
      if (!chat) {
        await logger.warn("scan", `IPA search could not resolve ${channelId}`, {
          query,
        });
        continue;
      }

      searchedChannels.push(channelId);

      const disabledTopicIds = await getDisabledTopicIds(channelId, client);
      let fromMessageId = 0;
      let batchesScanned = 0;

      while (distinctVersions.size < targetVersions) {
        const history = (await client.invoke({
          _: "getChatHistory",
          chat_id: chat.id,
          from_message_id: fromMessageId,
          offset: 0,
          limit: TELEGRAM_HISTORY_BATCH_SIZE,
          only_local: false,
        })) as ChatHistoryResponse;

        const messages = history.messages || [];
        if (messages.length === 0) {
          break;
        }

        batchesScanned++;
        totalBatchesScanned++;
        totalMessagesExamined += messages.length;

        // Count IPA files in this batch (regardless of search term match)
        const batchIpaCount = messages.filter(isIpaMessage).length;
        totalIpaFilesSeen += batchIpaCount;

        await onProgress?.({
          label: buildProgressLabel({
            mode: resolution.mode,
            resolvedTweakName: resolution.resolvedTweakName,
            channelId,
            channelIndex: channelIndex + 1,
            totalChannels: scopedChannels.length,
            distinctVersionsPresent: distinctVersions.size,
            targetVersions,
            batchesScanned,
          }),
          current: distinctVersions.size,
          total: targetVersions,
        });

        const candidates = collectMatchingIpaCandidates({
          channelId,
          messages,
          disabledTopicIds,
          searchTerms: resolution.searchTerms,
        });

        for (const candidate of candidates) {
          if (distinctVersions.size >= targetVersions) {
            break;
          }

          const candidateKey = `${candidate.channelId}:${candidate.messageId}`;
          if (seenCandidates.has(candidateKey)) {
            continue;
          }
          seenCandidates.add(candidateKey);

          const candidateResult = await importSearchCandidate(
            candidate,
            client,
            chatIdMap
          );

          if (candidateResult.finalStatus === "failed") {
            failedCount++;
          }

          const downloadedIpa = candidateResult.downloadedIpa;
          if (!downloadedIpa) {
            continue;
          }

          const tweaks = Array.isArray(downloadedIpa.tweaks)
            ? (downloadedIpa.tweaks as string[])
            : [];
          const variant = getVariantMeta(
            downloadedIpa.bundleId,
            downloadedIpa.appName,
            tweaks,
            downloadedIpa.isTweaked,
            settings.known_tweaks,
            downloadedIpa.channelId
          );

          if (
            resolution.mode === "known_tweak" &&
            variant.matchedTweak !== resolution.resolvedTweakName
          ) {
            continue;
          }

          if (!targetGroupKey) {
            targetGroupKey = variant.groupKey;
            distinctVersions = await getDistinctVersionsForGroupKey(
              targetGroupKey,
              settings.known_tweaks
            );
            if (candidateResult.processedNow) {
              importedCount = Math.min(1, distinctVersions.size);
              alreadyPresentCount = Math.max(
                0,
                distinctVersions.size - importedCount
              );
            } else {
              alreadyPresentCount = distinctVersions.size;
            }
          } else if (variant.groupKey === targetGroupKey) {
            const hadVersion = distinctVersions.has(downloadedIpa.version);
            distinctVersions = await getDistinctVersionsForGroupKey(
              targetGroupKey,
              settings.known_tweaks
            );
            if (
              candidateResult.processedNow &&
              candidateResult.finalStatus === "completed" &&
              !hadVersion &&
              distinctVersions.has(downloadedIpa.version)
            ) {
              importedCount++;
            }
          }

          await onProgress?.({
            label: buildProgressLabel({
              mode: resolution.mode,
              resolvedTweakName: resolution.resolvedTweakName,
              channelId,
              channelIndex: channelIndex + 1,
              totalChannels: scopedChannels.length,
              distinctVersionsPresent: distinctVersions.size,
              targetVersions,
              batchesScanned,
            }),
            current: distinctVersions.size,
            total: targetVersions,
          });
        }

        fromMessageId = messages[messages.length - 1]?.id ?? 0;
        if (messages.length < TELEGRAM_HISTORY_BATCH_SIZE || fromMessageId === 0) {
          break;
        }
      }
    } catch (error) {
      await logger.warn("scan", `IPA search failed in ${channelId}`, {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const distinctVersionsPresent = distinctVersions.size;
  const outcome =
    distinctVersionsPresent === 0
      ? "not_found"
      : distinctVersionsPresent >= targetVersions
        ? "completed"
        : "partial";

  const logMessage =
    outcome === "completed"
      ? `IPA search completed for "${query}"`
      : outcome === "partial"
        ? `IPA search partially backfilled "${query}"`
        : `IPA search found no importable versions for "${query}"`;

  await logger.info("scan", logMessage, {
    query,
    mode: resolution.mode,
    resolvedTweakName: resolution.resolvedTweakName,
    lockedChannelId: resolution.lockedChannelId,
    targetVersions,
    distinctVersionsPresent,
    importedCount,
    alreadyPresentCount,
    failedCount,
    searchedChannels,
    groupKey: targetGroupKey,
    batchesScanned: totalBatchesScanned,
    totalMessagesExamined,
    ipaFilesSeenInChannel: totalIpaFilesSeen,
    searchTerms: resolution.searchTerms,
  });

  return {
    outcome,
    query,
    mode: resolution.mode,
    resolvedTweakName: resolution.resolvedTweakName,
    lockedChannelId: resolution.lockedChannelId,
    targetVersions,
    distinctVersionsPresent,
    importedCount,
    alreadyPresentCount,
    failedCount,
    searchedChannels,
    groupKey: targetGroupKey,
    batchesScanned: totalBatchesScanned,
    totalMessagesExamined,
    ipaFilesSeenInChannel: totalIpaFilesSeen,
    searchTerms: resolution.searchTerms,
  };
}
