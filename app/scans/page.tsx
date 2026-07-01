"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  ListChecks,
  ShieldAlert,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAmtBrief } from "@/components/AmtBriefProvider";
import { RiskLevel, ScanRecord } from "@/lib/types";
import { getScanSectionHref } from "@/lib/routes";

export default function ScansPage() {
  const router = useRouter();
  const { scanHistory, selectScan } = useAmtBrief();

  if (scanHistory.length === 0) {
    return (
      <AppShell title="AmtBrief AI">
        <EmptyScans />
      </AppShell>
    );
  }

  const totalOpenCount = scanHistory.reduce(
    (count, scan) => count + getOpenCount(scan),
    0,
  );
  const totalTasks = scanHistory.reduce(
    (count, scan) => count + scan.analysis.checklist.length,
    0,
  );
  const completedTasks = scanHistory.reduce(
    (count, scan) => count + getCompletedCount(scan),
    0,
  );
  const progress = Math.round((completedTasks / Math.max(totalTasks, 1)) * 100);

  function openScan(scanId: string, href?: string) {
    selectScan(scanId);
    router.push(href ?? getScanSectionHref(scanId, "overview"));
  }

  return (
    <AppShell title="AmtBrief AI">
      <div className="space-y-4">
        <section className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">My Scans</h2>
            <p className="mt-1 text-sm text-slate-500">
              Your analyzed official letters
            </p>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2">
          <MetricCard label="Scans" value={String(scanHistory.length)} />
          <MetricCard label="Open steps" value={String(totalOpenCount)} />
          <MetricCard label="Done" value={`${progress}%`} />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Recent scans</h3>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 shadow-soft">
              Latest first
            </span>
          </div>

          {scanHistory.map((scan) => (
            <ScanCard
              key={scan.id}
              scan={scan}
              onOpen={(href) => openScan(scan.id, href)}
            />
          ))}
        </section>

      </div>
    </AppShell>
  );
}

function EmptyScans() {
  return (
    <div className="flex min-h-[calc(100svh-190px)] flex-col">
      <section className="space-y-1">
        <h2 className="text-xl font-semibold text-ink">My Scans</h2>
        <p className="text-sm text-slate-500">Your analyzed official letters</p>
      </section>

      <section className="flex flex-1 flex-col items-center justify-center pb-10 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-civic-200 bg-civic-100 text-civic-700 shadow-soft">
          <FileText className="h-8 w-8" />
        </div>
        <h2 className="text-base font-semibold text-ink">No scanned letters yet</h2>
        <p className="mt-2 max-w-[240px] text-sm leading-6 text-slate-500">
          Analyze a letter and your document history will appear here.
        </p>
        <div className="mt-6 w-full max-w-[240px]">
          <PrimaryButton href="/input">Analyze new letter</PrimaryButton>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[16px] border border-slate-200 bg-white p-3 text-center shadow-soft">
      <p className="text-lg font-bold leading-none text-ink">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-slate-500">{label}</p>
    </article>
  );
}

function ScanCard({
  scan,
  onOpen,
}: {
  scan: ScanRecord;
  onOpen: (href?: string) => void;
}) {
  const completedCount = getCompletedCount(scan);
  const openCount = getOpenCount(scan);
  const progress = Math.round(
    (completedCount / Math.max(scan.analysis.checklist.length, 1)) * 100,
  );

  return (
    <article className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-soft">
      <button
        type="button"
        onClick={() => onOpen(getScanSectionHref(scan.id, "overview"))}
        className="block w-full p-4 text-left active:bg-slate-50"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-civic-100 text-civic-700">
            <FileText className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-5 text-ink">
                  {scan.analysis.category}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {inferAuthority(scan.analysis.category, scan.sourceLabel)}
                </p>
              </div>
              <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <DeadlineChip deadline={scan.analysis.deadline} />
              <RiskChip risk={scan.analysis.risk_level} />
              {scan.reminderStatus === "handled" ? (
                <span className="inline-flex min-h-[28px] items-center rounded-full bg-mint px-2.5 text-xs font-semibold text-emerald-700">
                  Handled
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">
          {scan.analysis.source_excerpt || scan.analysis.summary}
        </p>

        <div className="mt-4 rounded-2xl border border-civic-100 bg-civic-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-civic-600" />
              <p className="text-xs font-semibold text-slate-700">
                {openCount} open, {completedCount} done
              </p>
            </div>
            <p className="text-xs font-semibold text-civic-700">{progress}%</p>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-civic-200">
            <div
              className="h-full rounded-full bg-civic-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </button>

      <div className="grid grid-cols-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => onOpen(getScanSectionHref(scan.id, "checklist"))}
          className="touch-target inline-flex items-center justify-center gap-2 px-3 py-3 text-xs font-semibold text-civic-700 active:bg-civic-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          Checklist
        </button>
        <button
          type="button"
          onClick={() => onOpen("/tasks")}
          className="touch-target inline-flex items-center justify-center gap-2 border-l border-slate-100 px-3 py-3 text-xs font-semibold text-slate-700 active:bg-slate-50"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Open tasks
        </button>
      </div>
    </article>
  );
}

function getCompletedCount(scan: ScanRecord) {
  return scan.analysis.checklist.filter((_, index) => scan.checklistCompleted[index])
    .length;
}

function getOpenCount(scan: ScanRecord) {
  if (scan.reminderStatus === "handled") return 0;
  return Math.max(scan.analysis.checklist.length - getCompletedCount(scan), 0);
}

function DeadlineChip({ deadline }: { deadline: string | null }) {
  return (
    <span className="inline-flex min-h-[28px] max-w-[170px] items-center gap-1.5 rounded-full bg-civic-100 px-2.5 text-xs font-semibold text-civic-700">
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
      className={`inline-flex min-h-[28px] items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${style}`}
    >
      <ShieldAlert className="h-3.5 w-3.5" />
      {risk.charAt(0).toUpperCase() + risk.slice(1)} risk
    </span>
  );
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
