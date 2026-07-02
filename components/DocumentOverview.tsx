"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Landmark,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAmtBrief } from "@/components/AmtBriefProvider";
import { DocumentTabs } from "@/components/DocumentTabs";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { buildOverviewModel, OverviewTone } from "@/lib/overview";
import { getScanExportHref, getScanSectionHref } from "@/lib/routes";
import { AnalysisInputType, AnalysisResult, ReminderStatus, RiskLevel } from "@/lib/types";

type MpowerPaymentState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "created"; transactionId: string }
  | { status: "error"; message: string };

export function DocumentOverview({
  analysis,
  checklistCompleted,
  createdAt,
  inputType,
  reminderStatus,
  scanId,
  sourceLabel,
}: {
  analysis: AnalysisResult;
  checklistCompleted?: Record<number, boolean>;
  createdAt?: string | null;
  inputType?: AnalysisInputType | null;
  reminderStatus?: ReminderStatus;
  scanId?: string | null;
  sourceLabel: string;
}) {
  const overview = buildOverviewModel(analysis, {
    checklistCompleted,
    createdAt,
    inputType,
    sourceLabel,
  });
  const priorityStyle = getPriorityStyle(overview.priority.risk);
  const deadlineStyle = getDeadlineCardStyle(overview.deadline.tone);
  const checklistHref = scanId ? getScanSectionHref(scanId, "checklist") : "/checklist";
  const checklistCta =
    overview.checklist.remainingCount > 0 ? "Review checklist" : "Open checklist";
  const { setReminderStatus } = useAmtBrief();
  const [copiedField, setCopiedField] = useState<"iban" | "reference" | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(reminderStatus === "handled");
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [mpowerPaymentState, setMpowerPaymentState] = useState<MpowerPaymentState>({
    status: "idle",
  });

  async function handleCopy(field: "iban" | "reference", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context) - silently ignore,
      // the IBAN/reference text is still visible to copy manually.
    }
  }

  async function handleConfirmPayment() {
    setConfirmingPayment(true);
    try {
      await setReminderStatus("handled");
      await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentAmount: overview.payment.amount,
          referenceNumber: overview.payment.referenceNumber,
          sourceLabel: overview.sourceLabel,
        }),
      }).catch(() => null);
      setPaymentConfirmed(true);
    } finally {
      setConfirmingPayment(false);
    }
  }

  async function handleTryMpowerPayment() {
    if (!scanId || !overview.payment.amountCents) return;

    setMpowerPaymentState({ status: "creating" });
    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanId,
          sourceLabel: overview.sourceLabel,
          amountCents: overview.payment.amountCents,
          description: overview.payment.referenceNumber || analysis.category,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        transactionId?: string;
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.transactionId) {
        setMpowerPaymentState({
          status: "error",
          message: payload.error || "Payment transaction could not be created.",
        });
        return;
      }

      setMpowerPaymentState({ status: "created", transactionId: payload.transactionId });
    } catch {
      setMpowerPaymentState({
        status: "error",
        message: "Payment transaction could not be created.",
      });
    }
  }

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
              {overview.sourceLabel}
            </p>
            <h2 className="mt-1 text-xl font-semibold leading-tight text-ink">
              {analysis.category}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <InfoPill>{overview.authority.label}</InfoPill>
              <InfoPill>{overview.sourceTypeLabel}</InfoPill>
              <InfoPill>{overview.receivedLabel}</InfoPill>
            </div>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-civic-100 text-civic-700">
            <FileText className="h-7 w-7" />
          </div>
        </div>
      </section>

      <section className={`rounded-[20px] border bg-white p-4 shadow-soft ${priorityStyle.border}`}>
        <div className="flex gap-3">
          <div className={`mt-1 h-auto w-1.5 shrink-0 rounded-full ${priorityStyle.bar}`} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Priority level
              </p>
              <RiskBadge risk={overview.priority.risk} />
            </div>
            <h3 className="mt-2 text-base font-semibold text-ink">
              {overview.priority.label}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {overview.priority.description}
            </p>
            <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-medium leading-5 text-slate-600">
              {overview.priority.reason}
            </p>
          </div>
        </div>
      </section>

      <section className={`rounded-[20px] border p-5 shadow-action ${deadlineStyle.card}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className={`mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] ${deadlineStyle.muted}`}>
              <CalendarDays className="h-4 w-4" />
              Deadline
            </div>
            <p className="text-2xl font-bold leading-tight">{overview.deadline.label}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`inline-flex min-h-[30px] items-center rounded-full px-3 text-xs font-bold ${deadlineStyle.pill}`}>
                {overview.deadline.relativeLabel}
              </span>
              <span className={`inline-flex min-h-[30px] items-center rounded-full px-3 text-xs font-bold ${deadlineStyle.pill}`}>
                {overview.deadline.typeLabel}
              </span>
            </div>
            <p className={`mt-3 text-sm leading-5 ${deadlineStyle.detail}`}>
              {overview.deadline.detail}
            </p>
            {overview.deadline.evidence ? (
              <div className="mt-3 rounded-2xl bg-black/10 px-3 py-2">
                <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${deadlineStyle.muted}`}>
                  Why?
                </p>
                <p className={`mt-1 text-sm italic leading-5 ${deadlineStyle.detail}`}>
                  &ldquo;{overview.deadline.evidence}&rdquo;
                </p>
              </div>
            ) : null}
          </div>
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${deadlineStyle.icon}`}>
            <CalendarDays className="h-6 w-6" />
          </div>
        </div>
      </section>

      <section className="app-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
            <Sparkles className="h-4 w-4" />
            AmtBrief AI summary
          </div>
          <StatusPill tone={overview.action.tone}>{overview.action.label}</StatusPill>
        </div>
        <p className="text-[15px] leading-7 text-slate-700">{analysis.summary}</p>

        <div className="mt-4 space-y-3 rounded-2xl border border-civic-200 bg-civic-50 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-civic-700">
              Action logic
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-800">
              {overview.action.detail}
            </p>
          </div>
          <div className="border-t border-civic-200 pt-3">
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

      {overview.payment.visible ? (
        <section className="app-card p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
            <Landmark className="h-4 w-4" />
            Payment
          </div>

          {overview.payment.amount ? (
            <p className="text-2xl font-bold leading-tight text-ink">
              {overview.payment.amount}
            </p>
          ) : null}

          <p className="mt-2 text-xs leading-5 text-slate-500">
            AmtBrief AI does not process this payment. Transfer it yourself via your
            bank using the official details in the letter. Any detected amount,
            IBAN, and reference are shown below, but please double-check them
            before sending money.
          </p>

          <div className="mt-3 space-y-2">
            {overview.payment.iban ? (
              <CopyRow
                label="IBAN"
                value={overview.payment.iban}
                copied={copiedField === "iban"}
                onCopy={() => handleCopy("iban", overview.payment.iban!)}
              />
            ) : (
              <InfoRow
                label="IBAN"
                value="Not safely detected - check the original letter before paying"
              />
            )}
            {overview.payment.referenceNumber ? (
              <CopyRow
                label="Reference (Verwendungszweck)"
                value={overview.payment.referenceNumber}
                copied={copiedField === "reference"}
                onCopy={() => handleCopy("reference", overview.payment.referenceNumber!)}
              />
            ) : null}
          </div>

          {overview.payment.authorityLink ? (
            <a
              href={overview.payment.authorityLink.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-civic-700"
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 shrink-0" />
                {overview.payment.authorityLink.label}
              </span>
            </a>
          ) : null}
          {overview.payment.authorityLink ? (
            <p className="mt-1.5 text-[11px] leading-4 text-slate-400">
              General official portal - not specific to this letter or bill.
            </p>
          ) : null}

          {overview.payment.amountCents ? (
            <div className="mt-3 rounded-2xl border border-dashed border-civic-300 bg-civic-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-civic-700">
                Platform payment demo
              </p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">
                This creates a real transaction through this app&apos;s own
                merchant account - it does not actually pay the authority. Use
                it to see the platform payment flow in action, not as a real
                bill payment.
              </p>

              {mpowerPaymentState.status === "created" ? (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-mint px-3 py-2 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Transaction created ({mpowerPaymentState.transactionId.slice(0, 8)}...) - check
                  your SuperApp to complete it.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleTryMpowerPayment}
                  disabled={mpowerPaymentState.status === "creating"}
                  className="touch-target mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-civic-300 bg-white px-3 py-2.5 text-xs font-semibold text-civic-700 disabled:opacity-60"
                >
                  {mpowerPaymentState.status === "creating"
                    ? "Creating transaction..."
                    : "Try platform payment (demo)"}
                </button>
              )}

              {mpowerPaymentState.status === "error" ? (
                <p className="mt-2 text-[11px] leading-4 text-rose-600">
                  {mpowerPaymentState.message}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4">
            {paymentConfirmed ? (
              <div className="flex items-center gap-2 rounded-2xl bg-mint px-3 py-2.5 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Marked as paid
              </div>
            ) : (
              <SecondaryButton onClick={handleConfirmPayment} disabled={confirmingPayment}>
                {confirmingPayment ? "Saving..." : "I've paid this"}
              </SecondaryButton>
            )}
          </div>
        </section>
      ) : null}

      <section className="app-card-subtle p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Recognized source
          </p>
          <StatusPill tone={overview.confidence.tone}>
            {overview.confidence.label}
          </StatusPill>
        </div>
        <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-700">
          {analysis.source_excerpt}
        </p>
        {overview.authority.source === "fallback" ? (
          <p className="mt-3 rounded-2xl bg-slate-100 px-3 py-2 text-xs font-medium leading-5 text-slate-500">
            The authority could not be identified with a strong keyword match.
          </p>
        ) : null}
      </section>

      <section className="app-card-subtle p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ClipboardList className="h-5 w-5 text-civic-600" />
            Documents to prepare
          </div>
          <StatusPill tone={overview.documents.totalCount > 0 ? "neutral" : "calm"}>
            {overview.documents.label}
          </StatusPill>
        </div>

        {overview.documents.preview.length > 0 ? (
          <div className="space-y-2">
            {overview.documents.preview.map((document) => (
              <div
                key={document}
                className="flex min-h-[44px] items-center gap-3 border-b border-slate-100 px-1 py-3 text-sm text-slate-700 last:border-b-0"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{document}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-white px-3 py-3 text-sm leading-6 text-slate-600">
            The letter does not name a concrete document list. Use the checklist
            to verify whether a reply or confirmation is still needed.
          </p>
        )}

        {overview.documents.hiddenCount > 0 ? (
          <p className="mt-3 text-xs font-semibold text-civic-700">
            +{overview.documents.hiddenCount} more in the checklist
          </p>
        ) : null}

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-civic-100 text-civic-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{overview.checklist.label}</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              {overview.checklist.remainingCount > 0
                ? `${overview.checklist.remainingCount} step${overview.checklist.remainingCount === 1 ? "" : "s"} still open`
                : "All detected next steps are marked complete"}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 pb-2">
        {scanId ? (
          <Link
            href={getScanExportHref(scanId)}
            className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-[15px] font-semibold text-slate-800 shadow-soft transition active:scale-[0.99]"
          >
            <Download className="h-5 w-5 text-civic-600" />
            Export visit pack
          </Link>
        ) : null}
        <PrimaryButton href={checklistHref} icon={<ArrowRight className="h-5 w-5" />}>
          {checklistCta}
        </PrimaryButton>
      </div>
    </div>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          {label}
        </p>
        <p className="truncate text-sm font-medium text-ink">{value}</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="touch-target inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-civic-700 transition active:scale-[0.97]"
      >
        <Copy className="h-3.5 w-3.5" />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-700">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium leading-5 text-amber-900">{value}</p>
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

function InfoPill({ children }: { children: string }) {
  return (
    <span className="inline-flex min-h-[30px] max-w-full items-center rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-600">
      <span className="truncate">{children}</span>
    </span>
  );
}

function StatusPill({
  children,
  tone,
}: {
  children: string;
  tone: OverviewTone;
}) {
  return (
    <span
      className={`inline-flex min-h-[30px] shrink-0 items-center rounded-full px-3 text-xs font-bold ${getTonePillClass(tone)}`}
    >
      {children}
    </span>
  );
}

function getPriorityStyle(risk: RiskLevel) {
  if (risk === "high") {
    return {
      border: "border-rose-200",
      bar: "bg-rose-500",
    };
  }

  if (risk === "medium") {
    return {
      border: "border-amber-200",
      bar: "bg-amber-500",
    };
  }

  return {
    border: "border-emerald-200",
    bar: "bg-emerald-500",
  };
}

function getDeadlineCardStyle(tone: OverviewTone) {
  if (tone === "danger") {
    return {
      card: "border-rose-200 bg-gradient-to-br from-rose-600 to-red-500 text-white",
      detail: "text-white/80",
      icon: "bg-white/15 text-white",
      muted: "text-white/75",
      pill: "bg-white/15 text-white",
    };
  }

  if (tone === "warning") {
    return {
      card: "border-civic-500/20 bg-gradient-to-br from-civic-600 to-indigo-600 text-white",
      detail: "text-white/80",
      icon: "bg-white/15 text-white",
      muted: "text-white/75",
      pill: "bg-white/15 text-white",
    };
  }

  if (tone === "calm") {
    return {
      card: "border-emerald-200 bg-gradient-to-br from-emerald-600 to-civic-600 text-white",
      detail: "text-white/80",
      icon: "bg-white/15 text-white",
      muted: "text-white/75",
      pill: "bg-white/15 text-white",
    };
  }

  return {
    card: "border-slate-200 bg-white text-ink shadow-soft",
    detail: "text-slate-600",
    icon: "bg-civic-100 text-civic-700",
    muted: "text-slate-500",
    pill: "bg-slate-100 text-slate-600",
  };
}

function getTonePillClass(tone: OverviewTone) {
  if (tone === "danger") return "bg-roseSoft text-rose-700";
  if (tone === "warning") return "bg-amberSoft text-amber-700";
  if (tone === "calm") return "bg-mint text-emerald-700";
  return "bg-civic-100 text-civic-700";
}
