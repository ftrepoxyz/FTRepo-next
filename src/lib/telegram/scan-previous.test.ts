import test from "node:test";
import assert from "node:assert/strict";
import {
  getPreviousScanStartCursor,
  processPreviousScanBatch,
  type TelegramHistoryMessage,
} from "./scan-previous";

function ipaMessage(id: number): TelegramHistoryMessage {
  return {
    id,
    content: {
      _: "messageDocument",
      document: {
        file_name: `app-${id}.ipa`,
        document: { size: 1024 },
      },
      caption: { text: `IPA ${id}` },
    },
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

test("previous scan starts from the saved cursor", () => {
  assert.equal(getPreviousScanStartCursor(BigInt(4321)), 4321);
  assert.equal(getPreviousScanStartCursor(0), 0);
  assert.equal(getPreviousScanStartCursor(null), 0);
});

test("previous scan advances from the stop point so later runs continue deeper", () => {
  const firstRun = processPreviousScanBatch({
    channelId: "@example",
    messages: [ipaMessage(300), textMessage(299), ipaMessage(298), ipaMessage(297)],
    processedMessageIds: new Set<number>(),
    disabledTopicIds: new Set<number>(),
    ipaTarget: 2,
    ipasSeen: 0,
  });

  assert.equal(firstRun.ipaMessages, 2);
  assert.equal(firstRun.nextCursor, 298);
  assert.equal(firstRun.shouldStop, true);
  assert.deepEqual(
    firstRun.collectedMessages.map((message) => message.messageId),
    [300, 299, 298]
  );

  const secondRun = processPreviousScanBatch({
    channelId: "@example",
    messages: [ipaMessage(298), ipaMessage(297), textMessage(296), ipaMessage(295)],
    processedMessageIds: new Set<number>([300, 298]),
    disabledTopicIds: new Set<number>(),
    ipaTarget: 2,
    ipasSeen: 0,
  });

  assert.equal(secondRun.ipaMessages, 2);
  assert.equal(secondRun.nextCursor, 295);
  assert.equal(secondRun.shouldStop, true);
  assert.deepEqual(
    secondRun.collectedMessages.map((message) => message.messageId),
    [297, 296, 295]
  );
});

test("disabled forum topics are marked skipped without counting toward the IPA target", () => {
  const skippedTopicId = 77;
  const result = processPreviousScanBatch({
    channelId: "@example",
    messages: [
      {
        ...ipaMessage(200),
        message_thread_id: skippedTopicId,
      },
      ipaMessage(199),
    ],
    processedMessageIds: new Set<number>(),
    disabledTopicIds: new Set<number>([skippedTopicId]),
    ipaTarget: 1,
    ipasSeen: 0,
  });

  assert.equal(result.ipaMessages, 1);
  assert.equal(result.nextCursor, 199);
  assert.equal(result.collectedMessages[0]?.status, "skipped");
  assert.equal(result.collectedMessages[1]?.hasIpa, true);
});
