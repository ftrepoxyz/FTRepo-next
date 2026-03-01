import { prisma } from "./db";

export type LogType =
  | "scan"
  | "download"
  | "process"
  | "upload"
  | "cleanup"
  | "generate"
  | "error"
  | "system";

export type LogStatus = "info" | "success" | "warning" | "error";

export async function log(
  type: LogType,
  message: string,
  status: LogStatus = "info",
  details?: Record<string, unknown>
) {
  try {
    await prisma.activityLog.create({
      data: {
        type,
        message,
        status,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
      },
    });
  } catch (e) {
    console.error("[Logger] Failed to write log:", e);
  }

  const prefix = `[${type.toUpperCase()}]`;
  if (status === "error") {
    console.error(prefix, message, details ?? "");
  } else if (status === "warning") {
    console.warn(prefix, message, details ?? "");
  } else {
    console.log(prefix, message);
  }
}

export const logger = {
  info: (type: LogType, message: string, details?: Record<string, unknown>) =>
    log(type, message, "info", details),
  success: (type: LogType, message: string, details?: Record<string, unknown>) =>
    log(type, message, "success", details),
  warn: (type: LogType, message: string, details?: Record<string, unknown>) =>
    log(type, message, "warning", details),
  error: (type: LogType, message: string, details?: Record<string, unknown>) =>
    log(type, message, "error", details),
};
