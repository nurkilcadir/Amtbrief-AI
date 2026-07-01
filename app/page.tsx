"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { useLang } from "@/components/LanguageProvider";
import { getTaskHref, getTaskRisk } from "@/lib/task-actions";
import { AnalysisResult, ReminderStatus, RiskLevel, ScanRecord } from "@/lib/types";
import { getScanSectionHref } from "@/lib/routes";
import type { T } from "@/lib/i18n";


type AuthProfile = {
  displayName: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

type HomeNextStep = {
  ctaLabel: string;
  deadline: string | null;
  documentRisk: RiskLevel;
  href: string;
  risk: RiskLevel;
  scanId: string | null;
  stepIndex: number;
  text: string;
};

export default function HomePage() {
  const router = useRouter();
  const { t } = useLang();
  const [authProfile, setAuthProfile] = useState<AuthProfile | null>(null);
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

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
      }).catch(() => null);

      if (!response?.ok) return;

      const payload = (await response.json().catch(() => null)) as
        | {
            authenticated?: boolean;
            user?: AuthProfile | null;
          }
        | null;

      if (mounted && payload?.authenticated && payload.user) {
        setAuthProfile(payload.user);
      }
    }

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

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
          userDisplayName={authProfile?.displayName ?? null}
          t={t}
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
            {t.home.title}
          </h2>
          <p className="mt-4 text-[15px] leading-6 text-slate-600">{t.home.subtitle}</p>
          <div className="mt-6 space-y-3">
            <PrimaryButton href="/input">{t.home.cta}</PrimaryButton>
            <SecondaryButton onClick={trySampleLetter} icon={<CalendarClock className="h-5 w-5 text-civic-600" />}>
              {t.home.sample}
            </SecondaryButton>
          </div>
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
  userDisplayName,
  t,
}: {
  analysis: AnalysisResult;
  activeScanId: string | null;
  checklistCompleted: Record<number, boolean>;
  reminderStatus: ReminderStatus;
  scanHistory: ScanRecord[];
  selectScan: (scanId: string) => void;
  sourceLabel: string;
  userDisplayName: string | null;
  t: T;
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
  const nextImportantStep = getNextImportantStep({
    activeScanId,
    analysis,
    checklistCompleted,
    reminderStatus,
    scanHistory,
  });
  const authority = inferAuthority(analysis.category, sourceLabel);
  const activeOverviewHref = activeScanId
    ? getScanSectionHref(activeScanId, "checklist")
    : "/analysis";

  return (
    <div className="space-y-4">
      <section className="space-y-1">
        <h2 className="break-words text-xl font-semibold text-ink">
          {t.home.welcome}{userDisplayName ? `, ${userDisplayName}` : ""}
        </h2>
        <p className="text-sm text-slate-500">
          {t.home.scanCount(scanCount)} · {t.home.openTasks(totalOpenCount)}
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
            <span className="block text-base font-semibold">{t.home.newLetter}</span>
            <span className="mt-0.5 block text-xs font-medium text-civic-100">{t.home.newLetterSub}</span>
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
              <h3 className="text-sm font-semibold text-ink">{t.home.nextStep}</h3>
              <p className="text-xs text-slate-500">
                {formatDeadline(nextImportantStep.deadline, t)}
              </p>
            </div>
          </div>
          <RiskChip risk={nextImportantStep.risk} t={t} />
        </div>

        <p className="text-[15px] font-medium leading-6 text-slate-900">
          {nextImportantStep.text}
        </p>

        <Link
          href={nextImportantStep.href}
          onClick={() => {
            if (nextImportantStep.scanId) {
              selectScan(nextImportantStep.scanId);
            }
          }}
          className="touch-target mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-civic-600 px-4 py-3 text-sm font-semibold text-white shadow-action active:scale-[0.99]"
        >
          {translateCtaLabel(nextImportantStep.ctaLabel, t)}
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
                {t.home.openCount(openCount)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-civic-100 bg-civic-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-700">{t.home.progress}</p>
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
          <h3 className="text-sm font-semibold text-slate-800">{t.home.recentScans}</h3>
          <Link href="/scans" className="touch-target -mr-2 inline-flex items-center justify-center rounded-lg px-2 text-xs font-semibold text-civic-700 active:bg-civic-100">
            {t.home.viewAll}
          </Link>
        </div>

        {scanHistory.slice(0, 3).map((scan) => (
          <Link
            key={scan.id}
            href={getScanSectionHref(scan.id, "checklist")}
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

function getNextImportantStep({
  activeScanId,
  analysis,
  checklistCompleted,
  reminderStatus,
  scanHistory,
}: {
  activeScanId: string | null;
  analysis: AnalysisResult;
  checklistCompleted: Record<number, boolean>;
  reminderStatus: ReminderStatus;
  scanHistory: ScanRecord[];
}): HomeNextStep {
  const candidates =
    scanHistory.length > 0
      ? scanHistory.flatMap((scan) => {
          const candidate = getScanNextStep(scan);
          return candidate ? [candidate] : [];
        })
      : [
          getAnalysisNextStep({
            analysis,
            checklistCompleted,
            reminderStatus,
            scanId: activeScanId,
          }),
        ].filter((candidate): candidate is HomeNextStep => Boolean(candidate));

  if (candidates.length === 0) {
    return {
      ctaLabel: "View scans",
      deadline: analysis.deadline,
      documentRisk: analysis.risk_level,
      href: "/scans",
      risk: analysis.risk_level,
      scanId: activeScanId,
      stepIndex: Number.MAX_SAFE_INTEGER,
      text: "Your scanned letters are marked as handled. Keep the documents and replies for your records.",
    };
  }

  return candidates.sort(compareHomeNextSteps)[0];
}

function getScanNextStep(scan: ScanRecord): HomeNextStep | null {
  return getAnalysisNextStep({
    analysis: scan.analysis,
    checklistCompleted: scan.checklistCompleted,
    createdAt: scan.createdAt,
    reminderStatus: scan.reminderStatus,
    scanId: scan.id,
  });
}

function getAnalysisNextStep({
  analysis,
  checklistCompleted,
  createdAt,
  reminderStatus,
  scanId,
}: {
  analysis: AnalysisResult;
  checklistCompleted: Record<number, boolean>;
  createdAt?: string;
  reminderStatus: ReminderStatus;
  scanId: string | null;
}): (HomeNextStep & { createdAt?: string; deadlineIso?: string | null }) | null {
  if (reminderStatus === "handled") {
    return null;
  }

  const stepIndex = analysis.checklist.findIndex(
    (_, index) => !checklistCompleted[index],
  );

  if (stepIndex === -1) {
    return {
      createdAt,
      ctaLabel: "Confirm final step",
      deadline: analysis.deadline,
      deadlineIso: analysis.deadline_iso,
      documentRisk: analysis.risk_level,
      href: "/reminder",
      risk: analysis.risk_level,
      scanId,
      stepIndex: Number.MAX_SAFE_INTEGER - 1,
      text: "All checklist steps are completed. Confirm the final reminder or keep the document for your records.",
    };
  }

  const step = analysis.checklist[stepIndex];

  return {
    createdAt,
    ctaLabel: "Open task",
    deadline: analysis.deadline,
    deadlineIso: analysis.deadline_iso,
    documentRisk: analysis.risk_level,
    href: scanId ? getTaskHref(scanId, step) : "/tasks",
    risk: getTaskRisk(step, analysis.risk_level),
    scanId,
    stepIndex,
    text: step,
  };
}

function compareHomeNextSteps(
  left: HomeNextStep & { createdAt?: string; deadlineIso?: string | null },
  right: HomeNextStep & { createdAt?: string; deadlineIso?: string | null },
) {
  return (
    riskRank(left.documentRisk) - riskRank(right.documentRisk) ||
    getDeadlineTime(left.deadlineIso) - getDeadlineTime(right.deadlineIso) ||
    riskRank(left.risk) - riskRank(right.risk) ||
    left.stepIndex - right.stepIndex ||
    getCreatedTime(right.createdAt) - getCreatedTime(left.createdAt)
  );
}

function riskRank(risk: RiskLevel) {
  return risk === "high" ? 0 : risk === "medium" ? 1 : 2;
}

function getDeadlineTime(deadlineIso: string | null | undefined) {
  if (!deadlineIso) return Number.MAX_SAFE_INTEGER;
  const date = new Date(deadlineIso);
  return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
}

function getCreatedTime(createdAt: string | undefined) {
  if (!createdAt) return 0;
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function RiskChip({ risk, t }: { risk: RiskLevel; t: T }) {
  const style =
    risk === "high"
      ? "bg-roseSoft text-rose-700"
      : risk === "medium"
        ? "bg-amberSoft text-amber-700"
        : "bg-mint text-emerald-700";
  const label = risk === "high" ? t.home.risk_high : risk === "medium" ? t.home.risk_medium : t.home.risk_low;

  return (
    <span className={`inline-flex min-h-[28px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${style}`}>
      <ShieldAlert className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function formatDeadline(deadline: string | null, t: T) {
  if (!deadline || deadline === "Not clearly detected") return t.home.noDeadline;
  return t.home.deadline(deadline);
}

function translateCtaLabel(label: string, t: T) {
  if (label === "Open task") return t.home.cta_openTask;
  if (label === "Confirm final step") return t.home.cta_confirmFinal;
  if (label === "View scans") return t.home.cta_viewScans;
  return label;
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
