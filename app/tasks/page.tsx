"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  FileText,
  ListChecks,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAmtBrief } from "@/components/AmtBriefProvider";
import { RiskLevel, ScanRecord } from "@/lib/types";
import { getScanSectionHref } from "@/lib/routes";

type TaskFilter = "all" | "urgent" | "today" | "completed";

type TaskCard = {
  scanId: string;
  index: number;
  title: string;
  subtitle: string;
  documentLabel: string;
  dueLabel: string;
  href: string;
  completed: boolean;
  risk: RiskLevel;
};

const filters: Array<{ value: TaskFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "urgent", label: "Urgent" },
  { value: "today", label: "Today" },
  { value: "completed", label: "Completed" },
];

export default function TasksPage() {
  const router = useRouter();
  const {
    scanHistory,
    selectScan,
    toggleScanChecklistItem,
  } = useAmtBrief();
  const [activeFilter, setActiveFilter] = useState<TaskFilter>("all");

  if (scanHistory.length === 0) {
    return (
      <AppShell title="AmtBrief AI">
        <EmptyTasks />
      </AppShell>
    );
  }

  const tasks = scanHistory.flatMap((scan) => buildTaskCards(scan));
  const pendingTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);
  const urgentTasks = pendingTasks.filter((task) => task.risk === "high");
  const todayTasks = pendingTasks.slice(0, Math.min(3, pendingTasks.length));
  const prioritySummary = getPrioritySummary(scanHistory, urgentTasks.length);
  const summaryDeadline = getSummaryDeadline(scanHistory);
  const visibleTasks =
    activeFilter === "completed"
      ? completedTasks
      : activeFilter === "urgent"
        ? urgentTasks
        : activeFilter === "today"
          ? todayTasks
          : pendingTasks;

  function openTask(task: TaskCard) {
    selectScan(task.scanId);
    router.push(task.href);
  }

  return (
    <AppShell title="AmtBrief AI">
      <div className="space-y-4">
        <section className="space-y-1">
          <h2 className="text-xl font-semibold text-ink">Tasks</h2>
          <p className="text-sm text-slate-500">Your pending bureaucracy steps</p>
        </section>

        <section className="rounded-[18px] border border-civic-200 bg-civic-100 p-4 shadow-soft">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-civic-600 text-white">
              <ListChecks className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base font-semibold text-ink">
                  {pendingTasks.length} pending{" "}
                  {pendingTasks.length === 1 ? "task" : "tasks"}
                </p>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-civic-700">
                  {summaryDeadline}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                {prioritySummary}
              </p>
            </div>
          </div>
        </section>

        <section className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {filters.map((filter) => {
            const active = activeFilter === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                aria-pressed={active}
                className={`touch-target shrink-0 rounded-full px-4 text-xs font-semibold transition active:scale-[0.98] ${
                  active
                    ? "bg-civic-600 text-white shadow-action"
                    : "border border-slate-200 bg-white text-slate-600 shadow-soft"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </section>

        <section className="space-y-3">
          {visibleTasks.length ? (
            visibleTasks.map((task) => (
              <TaskItem
                key={`${task.scanId}-${task.index}`}
                task={task}
                onToggle={() => toggleScanChecklistItem(task.scanId, task.index)}
                onOpen={() => openTask(task)}
              />
            ))
          ) : (
            <section className="app-card-subtle p-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-mint text-emerald-700">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-ink">
                No tasks in this view
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Switch filters or analyze another letter to create more steps.
              </p>
            </section>
          )}
        </section>

        {completedTasks.length ? (
          <section className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-800">Completed steps</p>
                <span className="rounded-full bg-civic-100 px-2 py-0.5 text-xs font-semibold text-civic-700">
                  {completedTasks.length}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </div>
          </section>
        ) : null}

        <Link
          href="/input"
          className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-[15px] font-semibold text-slate-800 shadow-soft active:scale-[0.99]"
        >
          <Plus className="h-5 w-5 text-civic-600" />
          Analyze another letter
        </Link>
      </div>
    </AppShell>
  );
}

function EmptyTasks() {
  return (
    <div className="flex min-h-[calc(100svh-190px)] flex-col">
      <section className="space-y-1">
        <h2 className="text-xl font-semibold text-ink">Tasks</h2>
        <p className="text-sm text-slate-500">Your pending bureaucracy steps</p>
      </section>

      <section className="flex flex-1 flex-col items-center justify-center pb-10 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-civic-200 bg-civic-100 text-civic-700 shadow-soft">
          <ListChecks className="h-8 w-8" />
        </div>
        <h2 className="text-base font-semibold text-ink">No pending tasks</h2>
        <p className="mt-2 max-w-[230px] text-sm leading-6 text-slate-500">
          Analyze a letter to create your first action plan.
        </p>
        <div className="mt-6 w-full max-w-[240px]">
          <PrimaryButton href="/input">Analyze new letter</PrimaryButton>
        </div>
      </section>
    </div>
  );
}

function TaskItem({
  task,
  onToggle,
  onOpen,
}: {
  task: TaskCard;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <article
      className={`rounded-[18px] border bg-white p-4 shadow-soft ${
        task.completed ? "border-slate-200 bg-slate-50/80" : "border-slate-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={task.completed ? "Mark task incomplete" : "Mark task complete"}
          aria-pressed={task.completed}
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
            task.completed
              ? "bg-civic-600 text-white"
              : "border border-slate-300 bg-white text-slate-400"
          }`}
        >
          {task.completed ? (
            <Check className="h-4 w-4" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`text-[15px] font-medium leading-5 ${
                task.completed
                  ? "text-slate-400 line-through decoration-slate-400/70"
                  : "text-ink"
              }`}
            >
              {task.title}
            </h3>
            <RiskPill risk={task.risk} completed={task.completed} />
          </div>

          <div className="mt-2 space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{task.documentLabel}</span>
            </p>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>{task.dueLabel}</span>
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-xs text-slate-500">{task.subtitle}</p>
            <button
              type="button"
              onClick={onOpen}
              className="touch-target inline-flex shrink-0 items-center justify-center rounded-lg px-2 text-xs font-semibold text-civic-700 active:bg-civic-100"
            >
              View document
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function RiskPill({
  risk,
  completed,
}: {
  risk: RiskLevel;
  completed: boolean;
}) {
  const style = completed
    ? "bg-slate-100 text-slate-500"
    : risk === "high"
      ? "bg-roseSoft text-rose-700"
      : risk === "medium"
        ? "bg-amberSoft text-amber-700"
        : "bg-mint text-emerald-700";

  return (
    <span
      className={`inline-flex min-h-[26px] shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-bold ${style}`}
    >
      <ShieldAlert className="h-3 w-3" />
      {completed ? "Done" : `${capitalizeRisk(risk)} Risk`}
    </span>
  );
}

function buildTaskCards(scan: ScanRecord): TaskCard[] {
  const documentLabel = inferAuthority(scan.analysis.category, scan.sourceLabel);

  return scan.analysis.checklist.map((step, index) => ({
    scanId: scan.id,
    index,
    title: step,
    subtitle: getTaskSubtitle(step, index),
    documentLabel,
    dueLabel: getDueLabel(step, scan.analysis.deadline),
    href: getTaskHref(scan.id, step),
    completed: scan.reminderStatus === "handled" || !!scan.checklistCompleted[index],
    risk: getTaskRisk(step, scan.analysis.risk_level),
  }));
}

function getTaskRisk(step: string, overallRisk: RiskLevel): RiskLevel {
  const text = step.toLowerCase();

  if (overallRisk === "high") {
    return "high";
  }

  if (
    text.includes("passport") ||
    text.includes("insurance") ||
    text.includes("rental") ||
    text.includes("income") ||
    text.includes("appointment") ||
    text.includes("deadline") ||
    text.includes("frist")
  ) {
    return "high";
  }

  if (text.includes("reply") || text.includes("send") || text.includes("contact")) {
    return "medium";
  }

  return overallRisk;
}

function getTaskHref(scanId: string, step: string) {
  const text = step.toLowerCase();

  if (text.includes("reply") || text.includes("send")) {
    return getScanSectionHref(scanId, "reply");
  }

  if (text.includes("reminder")) {
    return "/reminder";
  }

  return getScanSectionHref(scanId, "checklist");
}

function getDueLabel(step: string, deadline: string | null) {
  const text = step.toLowerCase();

  if (text.includes("reply") || text.includes("send")) {
    return "Reply recommended";
  }

  if (text.includes("copy") || text.includes("save")) {
    return "For your records";
  }

  if (!deadline || deadline === "Not clearly detected") {
    return "No fixed deadline";
  }

  return `Due before ${deadline}`;
}

function getTaskSubtitle(step: string, index: number) {
  const text = step.toLowerCase();

  if (text.includes("reply") || text.includes("send")) {
    return "Draft is ready to review";
  }
  if (text.includes("passport") || text.includes("photo")) {
    return "Bring the original and a copy if available";
  }
  if (text.includes("insurance") || text.includes("rental") || text.includes("income")) {
    return "Required document for the authority";
  }
  if (text.includes("reminder")) {
    return "Create a safety buffer before the deadline";
  }
  if (text.includes("save") || text.includes("copy")) {
    return "Keep proof for later questions";
  }

  return index === 0 ? "Start here" : "Recommended next action";
}

function formatDeadline(deadline: string | null) {
  if (!deadline || deadline === "Not clearly detected") {
    return "No deadline";
  }

  return deadline;
}

function getPrioritySummary(scanHistory: ScanRecord[], urgentTaskCount: number) {
  const activeDeadlines = scanHistory.filter(
    (scan) =>
      scan.reminderStatus !== "handled" &&
      scan.analysis.deadline &&
      scan.analysis.deadline !== "Not clearly detected",
  );
  const highestRiskDeadline = activeDeadlines.find(
    (scan) => scan.analysis.risk_level === "high",
  );

  if (highestRiskDeadline) {
    return "1 high-risk deadline";
  }

  if (activeDeadlines.length > 0) {
    return `${activeDeadlines.length} time-sensitive ${
      activeDeadlines.length === 1 ? "deadline" : "deadlines"
    }`;
  }

  if (scanHistory.every((scan) => scan.reminderStatus === "handled")) {
    return "All scanned letters are handled";
  }

  if (urgentTaskCount > 0) {
    return `${urgentTaskCount} priority ${urgentTaskCount === 1 ? "step" : "steps"}`;
  }

  return "No high-risk deadline detected";
}

function getSummaryDeadline(scanHistory: ScanRecord[]) {
  const nextDeadline = scanHistory.find(
    (scan) =>
      scan.reminderStatus !== "handled" &&
      scan.analysis.deadline &&
      scan.analysis.deadline !== "Not clearly detected",
  )?.analysis.deadline;

  return nextDeadline ?? "No deadline";
}

function capitalizeRisk(risk: RiskLevel) {
  return risk.charAt(0).toUpperCase() + risk.slice(1);
}

function inferAuthority(category: string, sourceLabel: string) {
  const text = `${category} ${sourceLabel}`.toLowerCase();

  if (text.includes("ausländer") || text.includes("immigration")) {
    return "Ausländerbehörde Letter";
  }
  if (text.includes("tax") || text.includes("steuer") || text.includes("finanz")) {
    return "Finanzamt Letter";
  }
  if (text.includes("krankenkasse") || text.includes("insurance")) {
    return "Krankenkasse Letter";
  }
  if (text.includes("jobcenter")) {
    return "Jobcenter Letter";
  }
  if (text.includes("bürgeramt")) {
    return "Bürgeramt Letter";
  }

  return "Official Letter";
}
