import { logger } from "../logger";
import { getSettings } from "../config";

type ScheduledTask = {
  name: string;
  fn: () => Promise<void>;
  intervalMs: number;
  timer?: ReturnType<typeof setInterval>;
  running: boolean;
};

const tasks: Map<string, ScheduledTask> = new Map();

/**
 * Register a task to run at a fixed interval.
 * Skips execution when the system is disabled.
 */
export function scheduleTask(
  name: string,
  fn: () => Promise<void>,
  intervalMinutes: number
): void {
  if (tasks.has(name)) {
    stopTask(name);
  }

  const task: ScheduledTask = {
    name,
    fn,
    intervalMs: intervalMinutes * 60 * 1000,
    running: false,
  };

  task.timer = setInterval(async () => {
    if (task.running) return; // Skip if previous run still active
    const settings = await getSettings();
    if (!settings.system_enabled) return; // Skip when system is offline
    task.running = true;
    try {
      await fn();
    } catch (e) {
      await logger.error("system", `Scheduled task '${name}' failed`, {
        error: String(e),
      });
    } finally {
      task.running = false;
    }
  }, task.intervalMs);

  tasks.set(name, task);
  logger.info("system", `Scheduled task '${name}' every ${intervalMinutes} minutes`);
}

/**
 * Stop a scheduled task.
 */
export function stopTask(name: string): void {
  const task = tasks.get(name);
  if (task?.timer) {
    clearInterval(task.timer);
    tasks.delete(name);
  }
}

/**
 * Stop all scheduled tasks.
 */
export function stopAllTasks(): void {
  for (const [name] of tasks) {
    stopTask(name);
  }
}

/**
 * Get status of all scheduled tasks.
 */
export function getScheduledTasks(): { name: string; intervalMs: number; running: boolean }[] {
  return Array.from(tasks.values()).map((t) => ({
    name: t.name,
    intervalMs: t.intervalMs,
    running: t.running,
  }));
}
