"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Sparkles,
} from "lucide-react";
import { DocumentTabs } from "@/components/DocumentTabs";
import { PrimaryButton } from "@/components/PrimaryButton";
import { AnalysisResult, RiskLevel } from "@/lib/types";
import { getScanSectionHref } from "@/lib/routes";

export function DocumentOverview({
  analysis,
  scanId,
  sourceLabel,
}: {
  analysis: AnalysisResult;
  scanId?: string | null;
  sourceLabel: string;
}) {
  const priority = getPriorityMeta(analysis.risk_level);
  const authority = inferAuthority(analysis.category, sourceLabel);
  const documentsPreview = analysis.required_documents.slice(0, 3);
  const checklistHref = scanId ? getScanSectionHref(scanId, "checklist") : "/checklist";
  const daysUntil = getDaysUntil(analysis.deadline_iso);

  return (
    <div className="space-y-4">
      <DocumentTabs scanId={scanId ?? undefined} />

      {analysis.confidence === "low" ? (
        <section className="flex items-start gap-3 rounded-[20px] border border-amber-200 bg-amberSoft p-4 text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm leading-6">
            AI is not fully confident in this analysis. Please double-check the
            deadline and required documents against the original letter before
            acting on them.
          </p>
        </section>
      ) : null}

      <section className="app-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-civic-600">
              {sourceLabel || "Official letter"}
            </p>
            <h2 className="mt-1 text-xl font-semibold leading-tight text-ink">
              {analysis.category}
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-600">{authority}</p>
            <p className="mt-1 text-xs text-slate-500">Received: Today</p>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-civic-100 text-civic-700">
            <FileText className="h-7 w-7" />
          </div>
        </div>
      </section>

      <section className={`rounded-[20px] border bg-white p-4 shadow-soft ${priority.border}`}>
        <div className="flex gap-3">
          <div className={`mt-1 h-auto w-1.5 shrink-0 rounded-full ${priority.bar}`} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Priority level
              </p>
              <RiskBadge risk={analysis.risk_level} />
            </div>
            <h3 className="mt-2 text-base font-semibold text-ink">{priority.label}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {priority.description}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[20px] border border-civic-500/20 bg-gradient-to-br from-civic-600 to-indigo-600 p-5 text-white shadow-action">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/75">
              <CalendarDays className="h-4 w-4" />
              Deadline
            </div>
            <p className="text-2xl font-bold leading-tight">
              {analysis.deadline ?? "No exact deadline"}
            </p>
            {daysUntil !== null ? (
              <p className="mt-1 text-xs font-semibold text-white/80">
                {daysUntil < 0
                  ? "This date has passed"
                  : daysUntil === 0
                    ? "Today"
                    : `In ${daysUntil} day${daysUntil === 1 ? "" : "s"}`}
              </p>
            ) : null}
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <CalendarDays className="h-6 w-6" />
          </div>
        </div>
      </section>

      <section className="app-card p-5">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
          <Sparkles className="h-4 w-4" />
          AmtBrief AI summary
        </div>
        <p className="text-[15px] leading-7 text-slate-700">{analysis.summary}</p>

        <div className="mt-4 space-y-3 rounded-2xl border border-civic-200 bg-civic-50 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-civic-700">
              Required action
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-800">
              {analysis.required_action}
            </p>
          </div>
          <div className="border-t border-civic-200 pt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-civic-700">
              Recommended next step
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-800">
              {analysis.recommended_next_step}
            </p>
          </div>
        </div>
      </section>

      <section className="app-card-subtle p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Recognized source
        </p>
        <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-700">
          {analysis.source_excerpt}
        </p>
      </section>

      <section className="app-card-subtle p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <ClipboardList className="h-5 w-5 text-civic-600" />
          Documents to prepare
        </div>
        <div className="space-y-2">
          {documentsPreview.map((document) => (
            <div
              key={document}
              className="flex min-h-[44px] items-center gap-3 border-b border-slate-100 px-1 py-3 text-sm text-slate-700 last:border-b-0"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{document}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="pb-2">
        <PrimaryButton href={checklistHref} icon={<ArrowRight className="h-5 w-5" />}>
          Review checklist
        </PrimaryButton>
      </div>
    </div>
  );
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const style =
    risk === "high"
      ? "bg-roseSoft text-rose-700"
      : risk === "medium"
        ? "bg-amberSoft text-amber-700"
        : "bg-mint text-emerald-700";

  return (
    <span
      className={`inline-flex min-h-[34px] shrink-0 items-center rounded-full px-3 text-xs font-bold uppercase ${style}`}
    >
      {risk}
    </span>
  );
}

function getPriorityMeta(risk: RiskLevel) {
  if (risk === "high") {
    return {
      label: "High priority",
      description:
        "Respond as soon as possible. Missing this may cause fines, rejection, or legal consequences.",
      border: "border-rose-200",
      bar: "bg-rose-500",
    };
  }

  if (risk === "medium") {
    return {
      label: "Medium action required",
      description:
        "This document needs attention before the deadline. A response or prepared documents are recommended.",
      border: "border-amber-200",
      bar: "bg-amber-500",
    };
  }

  return {
    label: "Low priority",
    description:
      "No immediate risk detected, but keep the document and follow the suggested next step.",
    border: "border-emerald-200",
    bar: "bg-emerald-500",
  };
}

function getDaysUntil(deadlineIso: string | null) {
  if (!deadlineIso) return null;

  const target = new Date(deadlineIso);
  if (Number.isNaN(target.getTime())) return null;

  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  return Math.round((startOfTarget.getTime() - startOfToday.getTime()) / msPerDay);
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
