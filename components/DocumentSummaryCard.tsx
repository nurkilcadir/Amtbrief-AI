"use client";

import { CalendarDays, FileText, ShieldAlert } from "lucide-react";
import { AnalysisResult, RiskLevel } from "@/lib/types";

export function CompactDocumentCard({
  analysis,
  sourceLabel,
}: {
  analysis: AnalysisResult;
  sourceLabel: string;
}) {
  return (
    <section className="app-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-civic-100 text-civic-700">
          <FileText className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-5 text-ink">
            {analysis.category}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {inferAuthority(analysis.category, sourceLabel)}
          </p>
        </div>
      </div>
    </section>
  );
}

export function DocumentMetaChips({ analysis }: { analysis: AnalysisResult }) {
  return (
    <div className="flex flex-wrap gap-2">
      <InfoChip
        icon={<CalendarDays className="h-3.5 w-3.5" />}
        label={analysis.deadline ?? "No deadline"}
      />
      <RiskChip risk={analysis.risk_level} />
    </div>
  );
}

function InfoChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex min-h-[30px] max-w-[148px] items-center gap-1.5 rounded-full bg-civic-100 px-2.5 text-xs font-semibold text-civic-700">
      {icon}
      <span className="truncate">{label}</span>
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
      className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold capitalize ${style}`}
    >
      <ShieldAlert className="h-3.5 w-3.5" />
      {risk}
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
