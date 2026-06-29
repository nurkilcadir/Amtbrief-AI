"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FileText,
  Landmark,
  ListChecks,
  MessageSquareText,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LegalNotes } from "@/components/LegalNotes";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useAmtBrief } from "@/components/AmtBriefProvider";
import { AnalysisResult, ReminderStatus, RiskLevel, ScanRecord } from "@/lib/types";
import { getScanSectionHref } from "@/lib/routes";

const valueCards = [
  {
    title: "Plain-language summary",
    text: "See what the letter actually means.",
    icon: FileText,
    color: "bg-civic-100 text-civic-700",
  },
  {
    title: "Deadline & risk detection",
    text: "Spot dates, delays, and missing items.",
    icon: ShieldAlert,
    color: "bg-amberSoft text-amber-700",
  },
  {
    title: "Ready-to-send German reply",
    text: "Move from confusion to action.",
    icon: MessageSquareText,
    color: "bg-mint text-emerald-700",
  },
];

export default function HomePage() {
  const router = useRouter();
  const {
    analysis,
    activeScanId,
    checklistCompleted,
    loadSampleDocument,
    reminderStatus,
    scanHistory,
    selectScan,
    sourceLabel,
  } = useAmtBrief();

  function trySampleLetter() {
    loadSampleDocument();
    router.push("/analysis");
  }

  if (analysis) {
    return (
      <AppShell title="AmtBrief AI">
        <HomeDashboard
          analysis={analysis}
          activeScanId={activeScanId}
          checklistCompleted={checklistCompleted}
          reminderStatus={reminderStatus}
          scanHistory={scanHistory}
          selectScan={selectScan}
          sourceLabel={sourceLabel}
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="AmtBrief AI">
      <div className="space-y-5">
        <section className="app-card p-5">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-civic-100 text-civic-700">
            <Landmark className="h-6 w-6" />
          </div>
          <h2 className="max-w-[340px] text-[28px] font-bold leading-[1.12] tracking-normal text-ink">
            Understand any German official letter in seconds.
          </h2>
          <p className="mt-4 text-[15px] leading-6 text-slate-600">
            Upload or paste a document. AmtBrief AI explains what it means, what
            you need to do, and prepares your next step.
          </p>
          <div className="mt-6 space-y-3">
            <PrimaryButton href="/input">Analyze a letter</PrimaryButton>
            <SecondaryButton
              onClick={trySampleLetter}
              icon={<CalendarClock className="h-5 w-5 text-civic-600" />}
            >
              Use example letter
            </SecondaryButton>
          </div>
        </section>

        <section className="grid gap-3">
          {valueCards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.title}
                className="app-card-subtle flex min-h-[88px] items-center gap-4 p-4"
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-ink">{card.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{card.text}</p>
                </div>
              </article>
            );
          })}
        </section>

        <LegalNotes />
      </div>
    </AppShell>
  );
}

function HomeDashboard({
  analysis,
  activeScanId,
  checklistCompleted,
  reminderStatus,
  scanHistory,
  selectScan,
  sourceLabel,
}: {
  analysis: AnalysisResult;
  activeScanId: string | null;
  checklistCompleted: Record<number, boolean>;
  reminderStatus: ReminderStatus;
  scanHistory: ScanRecord[];
  selectScan: (scanId: string) => void;
  sourceLabel: string;
}) {
  const completedCount = analysis.checklist.filter(
    (_, index) => checklistCompleted[index],
  ).length;
  const openCount =
    reminderStatus === "handled"
      ? 0
      : Math.max(analysis.checklist.length - completedCount, 0);
  const totalOpenCount =
    scanHistory.length > 0
      ? scanHistory.reduce((count, scan) => count + getScanOpenCount(scan), 0)
      : openCount;
  const scanCount = Math.max(scanHistory.length, 1);
  const progress = Math.round(
    (completedCount / Math.max(analysis.checklist.length, 1)) * 100,
  );
  const nextTaskIndex = analysis.checklist.findIndex(
    (_, index) => !checklistCompleted[index],
  );
  const nextTask =
    reminderStatus === "handled"
      ? "Your latest letter is marked as handled. Keep the document and reply for your records."
      : nextTaskIndex === -1
      ? "All checklist steps are completed. Confirm the final reminder or keep the document for your records."
      : analysis.checklist[nextTaskIndex];
  const authority = inferAuthority(analysis.category, sourceLabel);
  const activeOverviewHref = activeScanId
    ? getScanSectionHref(activeScanId, "overview")
    : "/analysis";

  return (
    <div className="space-y-4">
      <section className="space-y-1">
        <h2 className="text-xl font-semibold text-ink">Welcome back</h2>
        <p className="text-sm text-slate-500">
          You have {scanCount} scanned {scanCount === 1 ? "letter" : "letters"} and{" "}
          {totalOpenCount} open {totalOpenCount === 1 ? "step" : "steps"}.
        </p>
      </section>

      <Link
        href="/input"
        className="touch-target flex w-full items-center justify-between gap-4 rounded-[20px] bg-civic-600 px-5 py-5 text-white shadow-action active:scale-[0.99]"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-civic-700">
            <Plus className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-base font-semibold">Analyze new letter</span>
            <span className="mt-0.5 block text-xs font-medium text-civic-100">
              Scan, upload, or paste text
            </span>
          </span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0" />
      </Link>

      <section className="rounded-[20px] border border-amber-200 bg-white p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amberSoft text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">Next important step</h3>
              <p className="text-xs text-slate-500">{formatDeadline(analysis.deadline)}</p>
            </div>
          </div>
          <RiskChip risk={analysis.risk_level} />
        </div>

        <p className="text-[15px] font-medium leading-6 text-slate-900">{nextTask}</p>

        <Link
          href={
            reminderStatus === "handled"
              ? "/scans"
              : nextTaskIndex === -1
                ? "/reminder"
                : "/tasks"
          }
          className="touch-target mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-civic-600 px-4 py-3 text-sm font-semibold text-white shadow-action active:scale-[0.99]"
        >
          {reminderStatus === "handled"
            ? "View scans"
            : nextTaskIndex === -1
              ? "Confirm final step"
              : "Open tasks"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <section className="app-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-civic-100 text-civic-700">
            <FileText className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-5 text-ink">
                  {analysis.category}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{authority}</p>
              </div>
              <Link
                href={activeOverviewHref}
                aria-label="Open latest scan"
                className="touch-target -mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 active:bg-slate-100"
              >
                <ChevronRight className="h-5 w-5" />
              </Link>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <DeadlineChip deadline={analysis.deadline} />
              <span className="inline-flex min-h-[28px] items-center gap-1.5 rounded-full bg-civic-100 px-2.5 text-xs font-semibold text-civic-700">
                <ListChecks className="h-3.5 w-3.5" />
                {openCount} open
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-civic-100 bg-civic-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-700">
              Checklist progress
            </p>
            <p className="text-xs font-semibold text-civic-700">
              {completedCount}/{analysis.checklist.length}
            </p>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-civic-200">
            <div
              className="h-full rounded-full bg-civic-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Recent analyses</h3>
          <Link
            href="/scans"
            className="touch-target -mr-2 inline-flex items-center justify-center rounded-lg px-2 text-xs font-semibold text-civic-700 active:bg-civic-100"
          >
            View all
          </Link>
        </div>

        {scanHistory.slice(0, 3).map((scan) => (
          <Link
            key={scan.id}
            href={getScanSectionHref(scan.id, "overview")}
            onClick={() => selectScan(scan.id)}
            className="touch-target flex items-center gap-3 rounded-[18px] border border-slate-200 bg-white p-3 shadow-soft active:bg-slate-50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-civic-100 text-civic-700">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {inferAuthority(scan.analysis.category, scan.sourceLabel)}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {scan.analysis.category}
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          </Link>
        ))}
      </section>

      <LegalNotes />
    </div>
  );
}

function DeadlineChip({ deadline }: { deadline: string | null }) {
  return (
    <span className="inline-flex min-h-[28px] max-w-[168px] items-center gap-1.5 rounded-full bg-civic-100 px-2.5 text-xs font-semibold text-civic-700">
      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{deadline ?? "No deadline"}</span>
    </span>
  );
}

function RiskChip({ risk }: { risk: RiskLevel }) {
  const style =
    risk === "high"
      ? "bg-roseSoft text-rose-700"
      : risk === "medium"
        ? "bg-amberSoft text-amber-700"
        : "bg-mint text-emerald-700";

  return (
    <span
      className={`inline-flex min-h-[28px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${style}`}
    >
      <ShieldAlert className="h-3.5 w-3.5" />
      {risk.charAt(0).toUpperCase() + risk.slice(1)}
    </span>
  );
}

function formatDeadline(deadline: string | null) {
  if (!deadline || deadline === "Not clearly detected") {
    return "No exact deadline detected";
  }

  return `Deadline: ${deadline}`;
}

function inferAuthority(category: string, sourceLabel: string) {
  const text = `${category} ${sourceLabel}`.toLowerCase();

  if (text.includes("ausländer") || text.includes("immigration")) {
    return "Ausländerbehörde";
  }
  if (text.includes("tax") || text.includes("steuer") || text.includes("finanz")) {
    return "Finanzamt";
  }
  if (text.includes("krankenkasse") || text.includes("insurance")) {
    return "Krankenkasse";
  }
  if (text.includes("jobcenter")) {
    return "Jobcenter";
  }
  if (text.includes("bürgeramt")) {
    return "Bürgeramt";
  }

  return "German authority";
}

function getScanOpenCount(scan: ScanRecord) {
  if (scan.reminderStatus === "handled") return 0;

  const completedCount = scan.analysis.checklist.filter(
    (_, index) => scan.checklistCompleted[index],
  ).length;

  return Math.max(scan.analysis.checklist.length - completedCount, 0);
}
