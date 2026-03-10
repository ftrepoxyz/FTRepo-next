import type { Prisma, TelegramCommand, TelegramRuntimeState } from "@prisma/client";
import { prisma } from "../db";
import type {
  TelegramAuthState,
  TelegramCommandStatus,
  TelegramCommandType,
  TelegramStatusSnapshot,
} from "@/types/config";

export type {
  TelegramAuthState,
  TelegramCommandStatus,
  TelegramCommandType,
  TelegramStatusSnapshot,
};

export const TELEGRAM_RUNTIME_ID = 1;
export const TELEGRAM_WORKER_HEARTBEAT_TIMEOUT_MS = 30_000;
const ACTIVE_COMMAND_STATUSES: TelegramCommandStatus[] = ["pending", "running"];

export async function ensureTelegramRuntimeState(): Promise<TelegramRuntimeState> {
  return prisma.telegramRuntimeState.upsert({
    where: { id: TELEGRAM_RUNTIME_ID },
    update: {},
    create: { id: TELEGRAM_RUNTIME_ID },
  });
}

function mapStatus(runtime: TelegramRuntimeState): TelegramStatusSnapshot {
  const lastHeartbeatAt = runtime.lastHeartbeatAt?.toISOString() ?? null;
  const workerOnline =
    runtime.lastHeartbeatAt !== null &&
    Date.now() - runtime.lastHeartbeatAt.getTime() <= TELEGRAM_WORKER_HEARTBEAT_TIMEOUT_MS;

  return {
    state: runtime.state as TelegramAuthState,
    error: runtime.error,
    passwordHint: runtime.passwordHint,
    busy: runtime.currentCommandId !== null,
    sessionReady: runtime.sessionReady,
    currentCommandId: runtime.currentCommandId,
    currentCommandType: (runtime.currentCommandType as TelegramCommandType | null) ?? null,
    progressLabel: runtime.progressLabel,
    progressCurrent: runtime.progressCurrent,
    progressTotal: runtime.progressTotal,
    retryCount: runtime.retryCount,
    lastHeartbeatAt,
    lastConnectedAt: runtime.lastConnectedAt?.toISOString() ?? null,
    lastAuthAt: runtime.lastAuthAt?.toISOString() ?? null,
    workerOnline,
  };
}

export async function getTelegramAuthStatus(): Promise<TelegramStatusSnapshot> {
  const runtime = await ensureTelegramRuntimeState();
  return mapStatus(runtime);
}

export async function updateTelegramRuntimeState(
  data:
    | Prisma.TelegramRuntimeStateUpdateInput
    | Prisma.TelegramRuntimeStateUncheckedUpdateInput
): Promise<TelegramRuntimeState> {
  await ensureTelegramRuntimeState();
  return prisma.telegramRuntimeState.update({
    where: { id: TELEGRAM_RUNTIME_ID },
    data,
  });
}

export async function markTelegramWorkerHeartbeat(owner: string): Promise<void> {
  await updateTelegramRuntimeState({
    owner,
    lastHeartbeatAt: new Date(),
  });
}

function normalizePayload(
  payload: Record<string, unknown> | undefined
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (!payload) {
    return undefined;
  }
  return payload as Prisma.InputJsonValue;
}

async function findMatchingCommand(
  type: TelegramCommandType,
  payload?: Record<string, unknown>
): Promise<TelegramCommand | null> {
  const candidates = await prisma.telegramCommand.findMany({
    where: {
      type,
      status: {
        in: ACTIVE_COMMAND_STATUSES,
      },
    },
    orderBy: [{ requestedAt: "asc" }, { id: "asc" }],
    take: 10,
  });

  if (type !== "refresh_topics") {
    return candidates[0] ?? null;
  }

  const channelId = typeof payload?.channelId === "string" ? payload.channelId : null;
  if (!channelId) {
    return candidates[0] ?? null;
  }

  return (
    candidates.find((candidate) => {
      const value = candidate.payload as { channelId?: unknown } | null;
      return value?.channelId === channelId;
    }) ?? null
  );
}

export async function enqueueTelegramCommand(options: {
  type: TelegramCommandType;
  payload?: Record<string, unknown>;
  requestedByUserId?: number;
}): Promise<{ command: TelegramCommand; created: boolean }> {
  await ensureTelegramRuntimeState();

  const existing = await findMatchingCommand(options.type, options.payload);
  if (existing) {
    return { command: existing, created: false };
  }

  const command = await prisma.telegramCommand.create({
    data: {
      type: options.type,
      payload: normalizePayload(options.payload),
      requestedByUserId: options.requestedByUserId ?? null,
    },
  });

  return { command, created: true };
}

export async function claimNextTelegramCommand(
  owner: string
): Promise<TelegramCommand | null> {
  await ensureTelegramRuntimeState();

  const next = await prisma.telegramCommand.findFirst({
    where: { status: "pending" },
    orderBy: [{ requestedAt: "asc" }, { id: "asc" }],
  });

  if (!next) {
    return null;
  }

  const claimed = await prisma.telegramCommand.updateMany({
    where: {
      id: next.id,
      status: "pending",
    },
    data: {
      status: "running",
      startedAt: new Date(),
    },
  });

  if (claimed.count === 0) {
    return null;
  }

  await prisma.telegramRuntimeState.update({
    where: { id: TELEGRAM_RUNTIME_ID },
    data: {
      owner,
      currentCommandId: next.id,
      currentCommandType: next.type,
      progressLabel: null,
      progressCurrent: null,
      progressTotal: null,
      lastHeartbeatAt: new Date(),
    },
  });

  return prisma.telegramCommand.findUnique({
    where: { id: next.id },
  });
}

export async function completeTelegramCommand(
  commandId: number,
  result?: Record<string, unknown>
): Promise<void> {
  await prisma.telegramCommand.update({
    where: { id: commandId },
    data: {
      status: "completed",
      completedAt: new Date(),
      error: null,
      result: result ? (result as Prisma.InputJsonValue) : undefined,
    },
  });

  await prisma.telegramRuntimeState.update({
    where: { id: TELEGRAM_RUNTIME_ID },
    data: {
      currentCommandId: null,
      currentCommandType: null,
      progressLabel: null,
      progressCurrent: null,
      progressTotal: null,
    },
  });
}

export async function failTelegramCommand(
  commandId: number,
  error: string
): Promise<void> {
  await prisma.telegramCommand.update({
    where: { id: commandId },
    data: {
      status: "failed",
      completedAt: new Date(),
      error,
    },
  });

  await prisma.telegramRuntimeState.update({
    where: { id: TELEGRAM_RUNTIME_ID },
    data: {
      currentCommandId: null,
      currentCommandType: null,
      progressLabel: null,
      progressCurrent: null,
      progressTotal: null,
    },
  });
}

export async function clearTelegramCurrentCommand(commandId: number): Promise<void> {
  await prisma.telegramRuntimeState.updateMany({
    where: {
      id: TELEGRAM_RUNTIME_ID,
      currentCommandId: commandId,
    },
    data: {
      currentCommandId: null,
      currentCommandType: null,
      progressLabel: null,
      progressCurrent: null,
      progressTotal: null,
    },
  });
}
