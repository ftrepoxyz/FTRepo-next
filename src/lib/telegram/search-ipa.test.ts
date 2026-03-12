import test from "node:test";
import assert from "node:assert/strict";
import {
  collectMatchingIpaCandidates,
  normalizeIpaSearchTerm,
  resolveSearchIpaQuery,
} from "./search-ipa";
import type { TelegramHistoryMessage } from "./scan-previous";
import type { TweakConfig } from "@/types/config";

function ipaMessage(
  id: number,
  fileName: string,
  overrides: Partial<TelegramHistoryMessage> = {}
): TelegramHistoryMessage {
  return {
    id,
    content: {
      _: "messageDocument",
      document: {
        file_name: fileName,
        document: { size: 1024 },
      },
      caption: { text: fileName },
    },
    ...overrides,
  };
}

function textMessage(id: number): TelegramHistoryMessage {
  return {
    id,
    content: {
      _: "messageText",
    },
  };
}

test("normalizeIpaSearchTerm strips ipa suffix and punctuation", () => {
  assert.equal(normalizeIpaSearchTerm(" Reddit-Plus.ipa "), "reddit plus");
});

test("resolveSearchIpaQuery prefers exact alias matches and keeps locked channel", () => {
  const knownTweaks: TweakConfig[] = [
    {
      name: "Reddit Deluxe",
      aliases: ["Reddit"],
      lockedChannelId: "@thescholarslounge",
    },
  ];

  const result = resolveSearchIpaQuery("Reddit", knownTweaks);

  assert.equal(result.mode, "known_tweak");
  assert.equal(result.resolvedTweakName, "Reddit Deluxe");
  assert.equal(result.lockedChannelId, "@thescholarslounge");
  assert.deepEqual(result.searchTerms, ["reddit deluxe", "reddit"]);
});

test("resolveSearchIpaQuery falls back to the most specific substring tweak", () => {
  const knownTweaks: TweakConfig[] = [
    { name: "YouTube" },
    { name: "YouTube OLED", aliases: ["YTOLED"] },
  ];

  const result = resolveSearchIpaQuery("youtube", knownTweaks);

  assert.equal(result.mode, "known_tweak");
  assert.equal(result.resolvedTweakName, "YouTube");

  const substringResult = resolveSearchIpaQuery("oled", knownTweaks);
  assert.equal(substringResult.mode, "known_tweak");
  assert.equal(substringResult.resolvedTweakName, "YouTube OLED");
});

test("resolveSearchIpaQuery falls back to generic search when no tweak matches", () => {
  const result = resolveSearchIpaQuery("Apollo", [{ name: "Reddit" }]);

  assert.equal(result.mode, "generic");
  assert.equal(result.resolvedTweakName, null);
  assert.equal(result.lockedChannelId, null);
  assert.deepEqual(result.searchTerms, ["apollo"]);
});

test("collectMatchingIpaCandidates matches filenames case-insensitively", () => {
  const candidates = collectMatchingIpaCandidates({
    channelId: "@apps",
    messages: [
      ipaMessage(10, "RedditPlus_2026.ipa"),
      ipaMessage(9, "Apollo.ipa"),
      textMessage(8),
    ],
    disabledTopicIds: new Set<number>(),
    searchTerms: ["reddit"],
  });

  assert.deepEqual(
    candidates.map((candidate) => candidate.messageId),
    [10]
  );
});

test("collectMatchingIpaCandidates uses tweak aliases and ignores disabled forum topics", () => {
  const disabledTopicId = 77;
  const candidates = collectMatchingIpaCandidates({
    channelId: "@apps",
    messages: [
      ipaMessage(12, "YTOLED_v1.ipa"),
      ipaMessage(11, "YouTube OLED v2.ipa", {
        message_thread_id: disabledTopicId,
      }),
      ipaMessage(10, "Reddit v1.ipa"),
    ],
    disabledTopicIds: new Set<number>([disabledTopicId]),
    searchTerms: ["youtube oled", "ytoled"],
  });

  assert.deepEqual(
    candidates.map((candidate) => candidate.messageId),
    [12]
  );
});
