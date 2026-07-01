import { hasMpowerConfig, sendReminderChoiceMessage } from "@/lib/server/mpower";
import {
  getDueReminders,
  markReminderFailed,
  markReminderSent,
} from "@/lib/server/reminder-store";

type ReminderRunResult = {
  error?: string;
  ok: boolean;
  processed: number;
  results: Array<{
    error?: string;
    id: string;
    status: string;
  }>;
};

type SchedulerState = {
  initialTimer: NodeJS.Timeout | null;
  intervalTimer: NodeJS.Timeout;
  running: boolean;
  startedAt: string;
  warnedMissingConfig: boolean;
};

const schedulerKey = "__amtbriefReminderScheduler";
const missingConfigMessage =
  "mPower reminder config is missing. Set OIDC_ISSUER, OIDC_CLIENT_ID or MPOWER_SERVICE_UUID, OIDC_CLIENT_SECRET, MPOWER_BASE_URL, and MPOWER_TENANT.";

export async function runDueReminderBatch(limit = 25): Promise<ReminderRunResult> {
  if (!hasMpowerConfig()) {
    return {
      error: missingConfigMessage,
      ok: false,
      processed: 0,
      results: [],
    };
  }

  const dueReminders = await getDueReminders(limit);
  const results: ReminderRunResult["results"] = [];

  for (const reminder of dueReminders) {
    try {
      const sent = await sendReminderChoiceMessage({
        messageText: reminder.messageText,
        userId: reminder.userId,
      });
      const updated = await markReminderSent({
        id: reminder.id,
        mpowerInstanceId: sent.instanceId,
        mpowerMessageId: sent.messageId,
      });

      results.push({
        id: reminder.id,
        status: updated?.status ?? "sent",
      });
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : "Unknown mPower send failure";
      await markReminderFailed(reminder.id, failureReason);
      results.push({
        error: failureReason,
        id: reminder.id,
        status: "failed",
      });
    }
  }

  return {
    ok: true,
    processed: results.length,
    results,
  };
}

export function startReminderScheduler() {
  if (process.env.REMINDER_SCHEDULER_DISABLED === "true") {
    return;
  }

  if (process.env.NODE_ENV !== "production" && process.env.REMINDER_SCHEDULER_ENABLED !== "true") {
    return;
  }

  const globalState = globalThis as typeof globalThis & {
    [schedulerKey]?: SchedulerState;
  };

  if (globalState[schedulerKey]) {
    return;
  }

  const intervalMs = parsePositiveInteger(
    process.env.REMINDER_SCHEDULER_INTERVAL_MS,
    60_000,
  );
  const initialDelayMs = parsePositiveInteger(
    process.env.REMINDER_SCHEDULER_INITIAL_DELAY_MS,
    15_000,
  );
  const limit = parsePositiveInteger(process.env.REMINDER_SCHEDULER_LIMIT, 25);

  const state: SchedulerState = {
    initialTimer: null,
    intervalTimer: setInterval(() => {
      void runScheduledTick(state, limit);
    }, intervalMs),
    running: false,
    startedAt: new Date().toISOString(),
    warnedMissingConfig: false,
  };

  state.intervalTimer.unref?.();
  state.initialTimer = setTimeout(() => {
    void runScheduledTick(state, limit);
  }, initialDelayMs);
  state.initialTimer.unref?.();
  globalState[schedulerKey] = state;

  console.info(
    `[AmtBrief reminders] Scheduler started intervalMs=${intervalMs} initialDelayMs=${initialDelayMs}`,
  );
}

async function runScheduledTick(state: SchedulerState, limit: number) {
  if (state.running) {
    return;
  }

  state.running = true;

  try {
    const result = await runDueReminderBatch(limit);

    if (!result.ok) {
      if (!state.warnedMissingConfig) {
        console.warn(`[AmtBrief reminders] ${result.error}`);
        state.warnedMissingConfig = true;
      }
      return;
    }

    if (result.processed > 0) {
      console.info(
        `[AmtBrief reminders] Processed ${result.processed} due reminder(s): ${result.results
          .map((item) => `${item.id}:${item.status}`)
          .join(", ")}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scheduler failure";
    console.error(`[AmtBrief reminders] Scheduler tick failed: ${message}`);
  } finally {
    state.running = false;
  }
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
