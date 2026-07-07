import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { buildMiniAppShareLink } from "@/lib/server/miniapp-links";
import { AnalysisResult } from "@/lib/types";
import {
  buildSchedulableReminderPlan,
  ReminderCustomPoint,
  ReminderPlan,
} from "@/lib/reminders";

export type StoredReminderStatus =
  | "pending"
  | "sent"
  | "snoozed"
  | "handled"
  | "failed";

export type StoredReminder = {
  id: string;
  userId: string;
  scanId: string;
  sourceLabel: string;
  planType: ReminderPlan["type"];
  label: string;
  dateLabel: string;
  scheduledAt: string;
  status: StoredReminderStatus;
  messageText: string;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  failureReason: string | null;
  mpowerMessageId: string | null;
  mpowerInstanceId: string | null;
};

type ReminderCallbackEvent = {
  createdAt: string;
  messageType: string;
  responseText: string;
  userId: string;
};

type ReminderStore = {
  callbacks: ReminderCallbackEvent[];
  reminders: StoredReminder[];
  version: 1;
};

type ChoiceActionResult = {
  action: "handled" | "ignored" | "open_requested" | "snoozed";
  reminder: StoredReminder | null;
};

type StoreMutationResult<T> = {
  data: T;
  store: ReminderStore;
};

const defaultStore: ReminderStore = {
  callbacks: [],
  reminders: [],
  version: 1,
};

export async function scheduleReminders(input: {
  analysis: AnalysisResult;
  customPoints?: ReminderCustomPoint[];
  scanId: string;
  sourceLabel: string;
  userId: string;
}) {
  const { errors, plan, warnings } = buildSchedulableReminderPlan(
    input.analysis,
    input.customPoints,
  );
  const now = new Date().toISOString();

  if (errors.length > 0) {
    return {
      errors,
      plan,
      reminders: [],
      warnings,
    };
  }

  return mutateStore((store) => {
    const nextReminders = store.reminders.map((reminder) =>
      reminder.userId === input.userId &&
      reminder.scanId === input.scanId &&
      (reminder.status === "pending" || reminder.status === "snoozed")
        ? {
            ...reminder,
            status: "handled" as const,
            updatedAt: now,
          }
        : reminder,
    );

    const newReminders =
      plan.type === "none"
        ? []
        : plan.points
            .filter((point) => point.scheduledAt)
            .map((point): StoredReminder => {
              const scheduledAt = point.scheduledAt!;
              return {
                id: createReminderId(input.userId, input.scanId, point.label, scheduledAt),
                userId: input.userId,
                scanId: input.scanId,
                sourceLabel: input.sourceLabel || "Official letter",
                planType: plan.type,
                label: point.label,
                dateLabel: point.dateLabel,
                scheduledAt,
                status: "pending",
                messageText: buildReminderMessage({
                  analysis: input.analysis,
                  pointLabel: point.label,
                  sourceLabel: input.sourceLabel,
                }),
                createdAt: now,
                updatedAt: now,
                sentAt: null,
                failureReason: null,
                mpowerMessageId: null,
                mpowerInstanceId: null,
              };
            });

    const reminderIds = new Set(newReminders.map((reminder) => reminder.id));
    const dedupedHistory = nextReminders.filter((reminder) => !reminderIds.has(reminder.id));
    const nextStore = {
      ...store,
      reminders: [...dedupedHistory, ...newReminders],
    };

    return {
      data: {
        errors,
        plan,
        reminders: newReminders,
        warnings,
      },
      store: nextStore,
    };
  });
}

export async function markScanRemindersHandled(input: {
  scanId: string;
  userId: string;
}) {
  const updatedAt = new Date().toISOString();

  return mutateStore((store) => {
    const reminders = store.reminders.map((reminder) =>
      reminder.userId === input.userId && reminder.scanId === input.scanId
        ? {
            ...reminder,
            status: "handled" as const,
            updatedAt,
          }
        : reminder,
    );

    return {
      data: reminders.filter(
        (reminder) => reminder.userId === input.userId && reminder.scanId === input.scanId,
      ),
      store: {
        ...store,
        reminders,
      },
    };
  });
}

export async function getDueReminders(limit = 25, now = new Date()) {
  const store = await readStore();
  const nowTime = now.getTime();

  return store.reminders
    .filter((reminder) => {
      if (reminder.status !== "pending" && reminder.status !== "snoozed") {
        return false;
      }

      const scheduledTime = Date.parse(reminder.scheduledAt);
      return !Number.isNaN(scheduledTime) && scheduledTime <= nowTime;
    })
    .sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt))
    .slice(0, limit);
}

export async function markReminderSent(input: {
  id: string;
  mpowerInstanceId?: string;
  mpowerMessageId?: string;
}) {
  const updatedAt = new Date().toISOString();

  return updateReminder(input.id, (reminder) => ({
    ...reminder,
    failureReason: null,
    mpowerInstanceId: input.mpowerInstanceId ?? null,
    mpowerMessageId: input.mpowerMessageId ?? null,
    sentAt: updatedAt,
    status: "sent",
    updatedAt,
  }));
}

export async function markReminderFailed(id: string, failureReason: string) {
  const updatedAt = new Date().toISOString();

  return updateReminder(id, (reminder) => ({
    ...reminder,
    failureReason,
    status: "failed",
    updatedAt,
  }));
}

export async function applyMpowerChoice(input: {
  responseText: string;
  userId: string;
}) {
  const normalized = normalizeChoice(input.responseText);
  const updatedAt = new Date().toISOString();

  return mutateStore<ChoiceActionResult>((store) => {
    const latest = [...store.reminders]
      .filter(
        (reminder) =>
          reminder.userId === input.userId &&
          (reminder.status === "sent" || reminder.status === "snoozed"),
      )
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0];

    const callbacks = [
      ...store.callbacks,
      {
        createdAt: updatedAt,
        messageType: "choiceResponse",
        responseText: input.responseText,
        userId: input.userId,
      },
    ].slice(-100);

    if (!latest) {
      return {
        data: { action: "ignored", reminder: null },
        store: {
          ...store,
          callbacks,
        },
      };
    }

    const reminders = store.reminders.map((reminder) => {
      if (reminder.id !== latest.id) return reminder;

      if (normalized.includes("handled")) {
        return {
          ...reminder,
          status: "handled" as const,
          updatedAt,
        };
      }

      if (normalized.includes("tomorrow")) {
        return {
          ...reminder,
          scheduledAt: addDays(new Date(), 1).toISOString(),
          status: "snoozed" as const,
          updatedAt,
        };
      }

      return reminder;
    });

    return {
      data: {
        action: normalized.includes("handled")
          ? "handled"
          : normalized.includes("tomorrow")
            ? "snoozed"
            : "open_requested",
        reminder: latest,
      },
      store: {
        ...store,
        callbacks,
        reminders,
      },
    };
  });
}

export async function readReminderStore() {
  return readStore();
}

async function updateReminder(
  id: string,
  update: (reminder: StoredReminder) => StoredReminder,
) {
  return mutateStore((store) => {
    const reminders = store.reminders.map((reminder) =>
      reminder.id === id ? update(reminder) : reminder,
    );
    const reminder = reminders.find((item) => item.id === id) ?? null;

    return {
      data: reminder,
      store: {
        ...store,
        reminders,
      },
    };
  });
}

async function mutateStore<T>(
  mutation: (store: ReminderStore) => StoreMutationResult<T>,
) {
  const store = await readStore();
  const result = mutation(store);
  await writeStore(result.store);
  return result.data;
}

async function readStore(): Promise<ReminderStore> {
  try {
    const raw = await readFile(getStorePath(), "utf8");
    const parsed = JSON.parse(raw) as ReminderStore;

    return {
      callbacks: Array.isArray(parsed.callbacks) ? parsed.callbacks : [],
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
      version: 1,
    };
  } catch {
    return defaultStore;
  }
}

async function writeStore(store: ReminderStore) {
  await mkdir(getStoreDir(), { recursive: true });
  await writeFile(getStorePath(), JSON.stringify(store, null, 2));
}

function getStorePath() {
  return `${getStoreDir()}/reminders.json`;
}

function getStoreDir() {
  return process.env.REMINDER_STORE_DIR ?? "/tmp/amtbrief-ai";
}

function buildReminderMessage({
  analysis,
  pointLabel,
  sourceLabel,
}: {
  analysis: AnalysisResult;
  pointLabel: string;
  sourceLabel: string;
}) {
  const title = sourceLabel || analysis.category || "Official letter";
  const action = analysis.recommended_next_step || analysis.required_action;
  const deepLink = buildDeepLink();
  const deadline = analysis.deadline ? ` Deadline: ${analysis.deadline}.` : "";
  const link = deepLink ? `\n\nOpen AmtBrief AI: ${deepLink}` : "";

  return `AmtBrief AI reminder: ${pointLabel} for ${title}.${deadline}\n\nNext step: ${action}${link}`;
}

function buildDeepLink() {
  return buildMiniAppShareLink({
    open: "checklist",
  }) ?? "";
}

function createReminderId(
  userId: string,
  scanId: string,
  label: string,
  scheduledAt: string,
) {
  const hash = createHash("sha256")
    .update(`${userId}:${scanId}:${label}:${scheduledAt}`)
    .digest("hex")
    .slice(0, 16);

  return `reminder-${hash}`;
}

function normalizeChoice(choice: string) {
  return choice.toLowerCase().replace(/^\d+\s*·\s*/, "").trim();
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
