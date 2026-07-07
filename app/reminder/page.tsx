"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useAmtBrief } from "@/components/AmtBriefProvider";
import {
  buildReminderPlan,
  buildSchedulableReminderPlan,
} from "@/lib/reminders";
import type { ReminderCustomPoint, ReminderPoint } from "@/lib/reminders";
import { getScanSectionHref } from "@/lib/routes";
import {
  clearReminderNotifications,
  scheduleReminderNotifications,
} from "@/lib/native-notifications";
import type { ReminderStatus } from "@/lib/types";

type EditableReminderPoint = {
  id: string;
  label: string;
  localValue: string;
};

export default function ReminderPage() {
  const {
    activeScanId,
    analysis,
    reminderCustomPoints,
    reminderStatus,
    setReminderStatus,
    sourceLabel,
  } = useAmtBrief();
  const [customizing, setCustomizing] = useState(false);
  const [editablePoints, setEditablePoints] = useState<EditableReminderPoint[]>([]);
  const [savingReminder, setSavingReminder] = useState<ReminderStatus | null>(null);
  const [reminderSaveError, setReminderSaveError] = useState<string | null>(null);

  if (!analysis) {
    return (
      <AppShell title="Reminder">
        <section className="app-card p-5">
          <h2 className="text-xl font-semibold text-ink">No deadline yet</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Analyze a letter first to detect deadlines and next steps.
          </p>
          <div className="mt-5">
            <PrimaryButton href="/input">Analyze a letter</PrimaryButton>
          </div>
        </section>
      </AppShell>
    );
  }

  const defaultReminderPlan = buildReminderPlan(analysis);
  const customSchedule =
    reminderCustomPoints && reminderCustomPoints.length > 0
      ? buildSchedulableReminderPlan(analysis, reminderCustomPoints)
      : null;
  const reminderPlan = customSchedule?.errors.length
    ? defaultReminderPlan
    : customSchedule?.plan ?? defaultReminderPlan;
  const editablePayload = toCustomPayload(editablePoints);
  const editableSchedule = buildSchedulableReminderPlan(analysis, editablePayload);
  const detectedDeadlineIso = analysis.deadline_iso;
  const primaryReminderStatus = reminderPlan.type === "none" ? "handled" : "scheduled";
  const statusTitle =
    reminderStatus === "scheduled"
      ? reminderPlan.confirmationTitle
      : reminderPlan.type === "none"
        ? reminderPlan.confirmationTitle
        : "Marked handled";
  const statusDescription =
    reminderStatus === "scheduled"
      ? reminderPlan.confirmationDescription
      : reminderPlan.type === "none"
        ? reminderPlan.confirmationDescription
        : "This letter is marked as handled. Home, My Scans, and Tasks now reflect that status.";
  const canCustomize = defaultReminderPlan.type !== "none";

  function openCustomizeSheet() {
    const sourcePoints =
      reminderCustomPoints && reminderCustomPoints.length > 0
        ? reminderCustomPoints
        : defaultReminderPlan.points;
    setEditablePoints(toEditablePoints(sourcePoints));
    setCustomizing(true);
  }

  async function persistReminderStatus(
    status: ReminderStatus,
    customPoints?: ReminderCustomPoint[],
  ) {
    setSavingReminder(status);
    setReminderSaveError(null);

    try {
      await setReminderStatus(status, customPoints);
      // Native app: mirror the reminder as on-device notifications (the
      // SuperApp MiniApp path uses the server-side mPower scheduler instead).
      if (activeScanId) {
        const title = sourceLabel || analysis?.category || "Official letter";
        if (status === "scheduled") {
          const points = customPoints ?? reminderPlan.points;
          void scheduleReminderNotifications({
            scanId: activeScanId,
            title,
            points: points.map((p) => ({ label: p.label, scheduledAt: p.scheduledAt })),
          });
        } else if (status === "handled") {
          void clearReminderNotifications(activeScanId);
        }
      }
      return true;
    } catch (error) {
      setReminderSaveError(
        error instanceof Error && error.message
          ? error.message
          : "Reminder could not be saved. Please try again.",
      );
      return false;
    } finally {
      setSavingReminder(null);
    }
  }

  async function saveCustomReminders() {
    if (editableSchedule.errors.length > 0) return;
    const saved = await persistReminderStatus("scheduled", editablePayload);

    if (saved) {
      setCustomizing(false);
    }
  }

  function addCustomPoint() {
    setEditablePoints((current) => [
      ...current,
      {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: getNextCustomLabel(current),
        localValue: toDateTimeLocalValue(
          getNextCustomDate(current, detectedDeadlineIso),
        ),
      },
    ]);
  }

  function updateCustomPoint(id: string, updates: Partial<EditableReminderPoint>) {
    setEditablePoints((current) =>
      current.map((point) => (point.id === id ? { ...point, ...updates } : point)),
    );
  }

  function removeCustomPoint(id: string) {
    setEditablePoints((current) => current.filter((point) => point.id !== id));
  }

  return (
    <AppShell title="Reminder" eyebrow="Final step">
      <div className="space-y-4">
        <section className="app-card p-5">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-civic-600 text-white shadow-soft">
            <BellRing className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold leading-tight text-ink">
            Do you want to create a reminder before the deadline?
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-600">
            Detected date:{" "}
            <span className="font-semibold text-slate-900">
              {analysis.deadline ?? "No exact deadline"}
            </span>
          </p>
        </section>

        <section className="app-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-civic-100 text-civic-700">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-ink">{reminderPlan.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {reminderPlan.description}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {reminderPlan.points.map((point) => (
              <div
                key={`${point.label}-${point.dateLabel}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{point.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{point.dateLabel}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    point.tone === "urgent"
                      ? "bg-roseSoft text-rose-700"
                      : "bg-civic-100 text-civic-700"
                  }`}
                >
                  {point.tone === "urgent" ? "Today" : "Planned"}
                </span>
              </div>
            ))}
          </div>
          {canCustomize ? (
            <button
              type="button"
              onClick={openCustomizeSheet}
              className="touch-target mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-civic-200 bg-white px-4 py-3 text-sm font-semibold text-civic-700 active:bg-civic-50"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Customize reminders
            </button>
          ) : null}
        </section>

        {reminderStatus !== "none" ? (
          <section className="rounded-[20px] bg-mint p-4 shadow-soft">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-900">
              {reminderStatus === "scheduled" ? (
                <BellRing className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
              {statusTitle}
            </div>
            <p className="text-sm leading-6 text-emerald-950">
              {statusDescription}
            </p>
          </section>
        ) : null}

        {reminderSaveError ? (
          <section className="rounded-[20px] border border-rose-200 bg-roseSoft p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-800">
              <AlertTriangle className="h-4 w-4" />
              Reminder was not saved
            </div>
            <p className="text-sm leading-6 text-rose-800">{reminderSaveError}</p>
          </section>
        ) : null}

        <div className="grid gap-3">
          <PrimaryButton
            onClick={() => void persistReminderStatus(primaryReminderStatus)}
            disabled={savingReminder !== null}
            icon={<BellRing className="h-5 w-5" />}
          >
            {savingReminder === primaryReminderStatus ? "Saving..." : reminderPlan.primaryLabel}
          </PrimaryButton>
          <SecondaryButton
            onClick={() => void persistReminderStatus("handled")}
            disabled={savingReminder !== null}
            icon={<ClipboardCheck className="h-5 w-5 text-civic-600" />}
          >
            {savingReminder === "handled" ? "Saving..." : "I handled it"}
          </SecondaryButton>
          <Link
            href={activeScanId ? getScanSectionHref(activeScanId, "checklist") : "/checklist"}
            className="touch-target inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-[15px] font-semibold text-slate-800 shadow-soft active:scale-[0.99]"
          >
            Back to checklist
          </Link>
        </div>

        {reminderStatus === "handled" ? (
          <Link
            href="/input"
            className="touch-target inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-500 active:bg-slate-100"
          >
            Analyze another letter
          </Link>
        ) : null}

        {customizing ? (
          <section
            aria-label="Customize reminders"
            aria-modal="true"
            className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/32 px-0"
            role="dialog"
          >
            <div className="safe-bottom max-h-[86svh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_44px_rgba(15,23,42,0.22)]">
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
                    Reminder timing
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-ink">
                    Customize reminders
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Keep the recommended safety buffer or add your own reminder
                    time before the deadline.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomizing(false)}
                  aria-label="Close reminder customization"
                  className="touch-target inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {editablePoints.map((point, index) => (
                  <section
                    key={point.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">
                        Reminder {index + 1}
                      </p>
                      {editablePoints.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeCustomPoint(point.id)}
                          aria-label="Remove reminder"
                          className="touch-target inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 active:bg-white"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    <label className="block text-xs font-semibold text-slate-600">
                      Label
                      <input
                        value={point.label}
                        onChange={(event) =>
                          updateCustomPoint(point.id, { label: event.target.value })
                        }
                        className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-[16px] text-slate-900 outline-none ring-civic-500/20 focus:border-civic-500 focus:ring-4"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold text-slate-600">
                      Date and time
                      <input
                        type="datetime-local"
                        value={point.localValue}
                        onChange={(event) =>
                          updateCustomPoint(point.id, { localValue: event.target.value })
                        }
                        className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-[16px] text-slate-900 outline-none ring-civic-500/20 focus:border-civic-500 focus:ring-4"
                      />
                    </label>
                  </section>
                ))}
              </div>

              <button
                type="button"
                onClick={addCustomPoint}
                className="touch-target mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 active:bg-slate-50"
              >
                <Plus className="h-4 w-4 text-civic-600" />
                Add another reminder
              </button>

              {editableSchedule.errors.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-roseSoft p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-800">
                    <AlertTriangle className="h-4 w-4" />
                    Check reminder timing
                  </div>
                  <div className="space-y-1">
                    {editableSchedule.errors.map((error) => (
                      <p key={error} className="text-sm leading-5 text-rose-800">
                        {error}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {editableSchedule.warnings.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amberSoft p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    Timing note
                  </div>
                  <div className="space-y-1">
                    {editableSchedule.warnings.map((warning) => (
                      <p key={warning} className="text-sm leading-5 text-amber-800">
                        {warning}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {reminderSaveError ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-roseSoft p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-800">
                    <AlertTriangle className="h-4 w-4" />
                    Reminder was not saved
                  </div>
                  <p className="text-sm leading-5 text-rose-800">{reminderSaveError}</p>
                </div>
              ) : null}

              <div className="mt-5 grid gap-3">
                <PrimaryButton
                  onClick={saveCustomReminders}
                  disabled={editableSchedule.errors.length > 0 || savingReminder !== null}
                  icon={<BellRing className="h-5 w-5" />}
                >
                  {savingReminder === "scheduled" ? "Saving..." : "Save custom reminders"}
                </PrimaryButton>
                <button
                  type="button"
                  onClick={() => setCustomizing(false)}
                  className="touch-target inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-500 active:bg-slate-100"
                >
                  Keep recommended plan
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

function toEditablePoints(points: Array<ReminderPoint | ReminderCustomPoint>) {
  const datedPoints = points.filter((point) => point.scheduledAt);

  if (datedPoints.length === 0) {
    return [
      {
        id: "custom-default",
        label: "Follow-up reminder",
        localValue: toDateTimeLocalValue(getDefaultCustomDate()),
      },
    ];
  }

  return datedPoints.map((point, index) => ({
    id: `reminder-${index}-${point.scheduledAt}`,
    label: point.label,
    localValue: toDateTimeLocalValue(new Date(point.scheduledAt!)),
  }));
}

function toCustomPayload(points: EditableReminderPoint[]): ReminderCustomPoint[] {
  return points.map((point) => ({
    label: point.label,
    scheduledAt: toIsoFromDateTimeLocal(point.localValue),
  }));
}

function toIsoFromDateTimeLocal(value: string) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getDefaultCustomDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

function getNextCustomDate(
  points: EditableReminderPoint[],
  deadlineIso: string | null,
) {
  const validDates = points
    .map((point) => new Date(point.localValue))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => right.getTime() - left.getTime());
  const candidate = validDates[0]
    ? new Date(validDates[0].getTime() + 60 * 60 * 1000)
    : getDefaultCustomDate();
  const deadline = deadlineIso ? new Date(deadlineIso) : null;

  if (deadline && !Number.isNaN(deadline.getTime()) && candidate > deadline) {
    const beforeDeadline = new Date(deadline.getTime() - 60 * 60 * 1000);

    if (beforeDeadline.getTime() > Date.now()) {
      return beforeDeadline;
    }
  }

  return candidate;
}

function getNextCustomLabel(points: EditableReminderPoint[]) {
  const extraReminderCount = points.filter((point) =>
    point.label.trim().toLowerCase().startsWith("extra reminder"),
  ).length;
  const nextIndex = extraReminderCount + 1;

  return nextIndex === 1 ? "Extra reminder" : `Extra reminder ${nextIndex}`;
}

function toDateTimeLocalValue(date: Date) {
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
