"use client";

import Link from "next/link";
import { Bell, Check, Circle, MessageSquareText } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DocumentTabs } from "@/components/DocumentTabs";
import {
  CompactDocumentCard,
  DocumentMetaChips,
} from "@/components/DocumentSummaryCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAmtBrief } from "@/components/AmtBriefProvider";
import { getScanSectionHref } from "@/lib/routes";

export function ChecklistView({ scanId }: { scanId?: string }) {
  const {
    analysis,
    checklistCompleted,
    replyDraft,
    sourceLabel,
    toggleChecklistItem,
  } = useAmtBrief();

  if (!analysis) {
    return (
      <AppShell title="Checklist">
        <section className="app-card p-5">
          <h2 className="text-xl font-semibold text-ink">No checklist yet</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Analyze a letter first, then AmtBrief AI will turn it into practical
            steps.
          </p>
          <div className="mt-5">
            <PrimaryButton href="/input">Analyze a letter</PrimaryButton>
          </div>
        </section>
      </AppShell>
    );
  }

  const completedCount = analysis.checklist.filter((_, index) => checklistCompleted[index])
    .length;
  const totalCount = Math.max(analysis.checklist.length, 1);
  const progress = Math.round((completedCount / totalCount) * 100);
  const firstOpenIndex = analysis.checklist.findIndex(
    (_, index) => !checklistCompleted[index],
  );
  const nextOpenIndex = firstOpenIndex === -1 ? analysis.checklist.length : firstOpenIndex;
  const replyHref = scanId ? getScanSectionHref(scanId, "reply") : "/reply";

  return (
    <AppShell title="Document Summary" eyebrow="AmtBrief AI">
      <div className="space-y-4">
        <CompactDocumentCard analysis={analysis} sourceLabel={sourceLabel} />
        <DocumentTabs scanId={scanId} />

        <section className="space-y-3">
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">Action Items</h2>
              <p className="mt-1 text-sm text-slate-500">
                {completedCount} of {analysis.checklist.length} tasks completed
              </p>
            </div>
            <DocumentMetaChips analysis={analysis} />
          </div>

          <div className="h-1.5 rounded-full bg-civic-200">
            <div
              className="h-full rounded-full bg-civic-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        <section className="space-y-3">
          {analysis.checklist.map((step, index) => {
            const checked = !!checklistCompleted[index];
            const current = !checked && index === nextOpenIndex;
            const subtitle = getTaskSubtitle(step, index, checked);

            return (
              <button
                key={step}
                onClick={() => toggleChecklistItem(index)}
                aria-pressed={checked}
                className={`touch-target flex w-full items-start gap-3 rounded-xl border bg-white p-4 text-left shadow-soft transition active:scale-[0.99] ${
                  checked
                    ? "border-slate-200 bg-slate-50"
                    : current
                      ? "border-civic-300 border-l-4 border-l-civic-600"
                      : "border-slate-200/80"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    checked
                      ? "bg-civic-600 text-white"
                      : current
                        ? "border border-civic-600 bg-white text-civic-600"
                        : "border border-slate-300 bg-white text-slate-400"
                  }`}
                >
                  {checked ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-[15px] font-medium leading-5 ${
                      checked
                        ? "text-slate-400 line-through decoration-slate-400/70"
                        : "text-slate-900"
                    }`}
                  >
                    {step}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {subtitle}
                  </span>
                </span>
              </button>
            );
          })}
        </section>

        <div className="grid gap-3 pt-8">
          <PrimaryButton href={replyHref} icon={<MessageSquareText className="h-5 w-5" />}>
            {replyDraft ? "Review German reply" : "Draft German reply"}
          </PrimaryButton>
          <Link
            href="/reminder"
            className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-[15px] font-semibold text-slate-800 shadow-soft active:scale-[0.99]"
          >
            <Bell className="h-5 w-5 text-civic-600" />
            Set reminder before deadline
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function getTaskSubtitle(step: string, index: number, checked: boolean) {
  if (checked) {
    return "Completed";
  }

  const text = step.toLowerCase();

  if (
    text.includes("passport") ||
    text.includes("photo") ||
    text.includes("insurance") ||
    text.includes("rental") ||
    text.includes("landlord") ||
    text.includes("income") ||
    text.includes("enrollment")
  ) {
    return "Prepare this document before the appointment";
  }
  if (text.includes("reply") || text.includes("send")) {
    return "Draft is ready to review";
  }
  if (text.includes("appointment") || text.includes("contact")) {
    return "Time-sensitive step before the deadline";
  }
  if (text.includes("copy") || text.includes("record")) {
    return "Keep proof for your records";
  }

  return index === 0 ? "Start here" : "Recommended next action";
}
