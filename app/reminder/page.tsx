"use client";

import Link from "next/link";
import { BellRing, CheckCircle2, ClipboardCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useAmtBrief } from "@/components/AmtBriefProvider";
import { getScanSectionHref } from "@/lib/routes";

export default function ReminderPage() {
  const { activeScanId, analysis, reminderStatus, setReminderStatus } = useAmtBrief();

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
            Deadline detected:{" "}
            <span className="font-semibold text-slate-900">
              {analysis.deadline ?? "No exact deadline"}
            </span>
          </p>
        </section>

        {reminderStatus !== "none" ? (
          <section className="rounded-[20px] bg-mint p-4 shadow-soft">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-900">
              {reminderStatus === "scheduled" ? (
                <BellRing className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
              {reminderStatus === "scheduled" ? "Reminder prepared" : "Marked handled"}
            </div>
            <p className="text-sm leading-6 text-emerald-950">
              {reminderStatus === "scheduled"
                ? "The reminder preference is saved for this letter and reflected across Home, My Scans, and Tasks."
                : "This letter is marked as handled. Home, My Scans, and Tasks now reflect that status."}
            </p>
          </section>
        ) : null}

        <div className="grid gap-3">
          <PrimaryButton
            onClick={() => setReminderStatus("scheduled")}
            icon={<BellRing className="h-5 w-5" />}
          >
            Remind me 3 days before
          </PrimaryButton>
          <SecondaryButton
            onClick={() => setReminderStatus("handled")}
            icon={<ClipboardCheck className="h-5 w-5 text-civic-600" />}
          >
            I handled it
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
      </div>
    </AppShell>
  );
}
