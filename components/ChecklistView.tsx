"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Landmark,
  MessageSquareText,
  ShieldAlert,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DocumentTabs } from "@/components/DocumentTabs";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAmtBrief } from "@/components/AmtBriefProvider";
import { useLang } from "@/components/LanguageProvider";
import { buildOverviewModel } from "@/lib/overview";
import { getScanExportHref, getScanSectionHref } from "@/lib/routes";
import type { RiskLevel } from "@/lib/types";
import type { T } from "@/lib/i18n";

type MpowerPaymentState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "created"; transactionId: string }
  | { status: "error"; message: string };

export function ChecklistView({ scanId }: { scanId?: string }) {
  const { t } = useLang();
  const {
    analysis,
    checklistCompleted,
    replyDraft,
    sourceLabel,
    toggleChecklistItem,
  } = useAmtBrief();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<"iban" | "reference" | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [mpowerPaymentState, setMpowerPaymentState] = useState<MpowerPaymentState>({
    status: "idle",
  });

  useEffect(() => {
    setPaymentConfirmed(readPaymentDone(scanId));
    setMpowerPaymentState({ status: "idle" });
    setCopiedField(null);
  }, [scanId]);

  if (!analysis) {
    return (
      <AppShell title={t.checklist.pageTitle}>
        <section className="app-card p-5">
          <h2 className="text-xl font-semibold text-ink">{t.checklist.emptyTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{t.checklist.emptySubtitle}</p>
          <div className="mt-5">
            <PrimaryButton href="/input">{t.checklist.emptyBtn}</PrimaryButton>
          </div>
        </section>
      </AppShell>
    );
  }

  const overview = buildOverviewModel(analysis, {
    checklistCompleted,
    sourceLabel,
  });
  const paymentVisible = overview.payment.visible;
  const completedCount =
    analysis.checklist.filter((_, index) => checklistCompleted[index]).length +
    (paymentVisible && paymentConfirmed ? 1 : 0);
  const totalCount = Math.max(
    analysis.checklist.length + (paymentVisible ? 1 : 0),
    1,
  );
  const progress = Math.round((completedCount / totalCount) * 100);
  const firstOpenIndex = analysis.checklist.findIndex((_, index) => !checklistCompleted[index]);
  const nextOpenIndex = firstOpenIndex === -1 ? analysis.checklist.length : firstOpenIndex;
  const replyHref = scanId ? getScanSectionHref(scanId, "reply") : "/reply";
  const category = analysis.category;

  async function handleCopy(field: "iban" | "reference", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(
        () => setCopiedField((current) => (current === field ? null : current)),
        2000,
      );
    } catch {
      // The value remains visible if clipboard access is unavailable.
    }
  }

  async function handleConfirmPayment() {
    setConfirmingPayment(true);
    try {
      await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentAmount: overview.payment.amount,
          referenceNumber: overview.payment.referenceNumber,
          sourceLabel: overview.sourceLabel,
        }),
      }).catch(() => null);
      writePaymentDone(scanId, true);
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
          description: overview.payment.referenceNumber || category,
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

      setMpowerPaymentState({
        status: "created",
        transactionId: payload.transactionId,
      });
    } catch {
      setMpowerPaymentState({
        status: "error",
        message: "Payment transaction could not be created.",
      });
    }
  }

  return (
    <AppShell title={t.checklist.pageTitle} eyebrow="AmtBrief AI">
      <div className="space-y-4">
        {/* Collapsible summary header */}
        <section className="app-card overflow-hidden">
          <button
            type="button"
            onClick={() => setSummaryOpen((v) => !v)}
            className="touch-target flex w-full items-center justify-between gap-3 p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{analysis.category}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <RiskChip risk={analysis.risk_level} t={t} />
                {paymentVisible ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amberSoft px-2.5 text-[11px] font-semibold text-amber-700">
                    <CreditCard className="h-3 w-3" />
                    Payment detected
                  </span>
                ) : null}
                {analysis.deadline ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-civic-100 px-2.5 text-[11px] font-semibold text-civic-700">
                    <CalendarDays className="h-3 w-3" />
                    {analysis.deadline}
                  </span>
                ) : null}
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${summaryOpen ? "rotate-180" : ""}`} />
          </button>
          {summaryOpen ? (
            <div className="border-t border-slate-100 px-4 pb-4 pt-3">
              <p className="text-sm leading-6 text-slate-700">{analysis.summary}</p>
              <p className="mt-2 text-xs text-slate-500">{sourceLabel}</p>
            </div>
          ) : null}
        </section>

        <DocumentTabs scanId={scanId} />

        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-ink">{t.checklist.tasksTitle}</h2>
            <p className="text-sm text-slate-500">{t.checklist.progress(completedCount, totalCount)}</p>
          </div>
          <div className="h-1.5 rounded-full bg-civic-200">
            <div className="h-full rounded-full bg-civic-600 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </section>

        <section className="space-y-3">
          {paymentVisible ? (
            <PaymentTaskCard
              amount={overview.payment.amount}
              amountCents={overview.payment.amountCents}
              authorityLink={overview.payment.authorityLink}
              category={category}
              copiedField={copiedField}
              deadline={analysis.deadline}
              iban={overview.payment.iban}
              mpowerPaymentState={mpowerPaymentState}
              onConfirmPayment={handleConfirmPayment}
              onCopy={handleCopy}
              onTryMpowerPayment={handleTryMpowerPayment}
              paymentConfirmed={paymentConfirmed}
              referenceNumber={overview.payment.referenceNumber}
              scanId={scanId}
              sourceExcerpt={analysis.source_excerpt}
              submitting={confirmingPayment}
            />
          ) : null}

          {analysis.checklist.map((step, index) => {
            const checked = !!checklistCompleted[index];
            const current = !checked && index === nextOpenIndex;
            const subtitle = getTaskSubtitle(step, index, checked, t);

            return (
              <button
                key={step}
                onClick={() => toggleChecklistItem(index)}
                aria-pressed={checked}
                className={`touch-target flex w-full items-start gap-3 rounded-xl border bg-white p-4 text-left shadow-soft transition active:scale-[0.99] ${
                  checked ? "border-slate-200 bg-slate-50" : current ? "border-civic-300 border-l-4 border-l-civic-600" : "border-slate-200/80"
                }`}
              >
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  checked ? "bg-civic-600 text-white" : current ? "border border-civic-600 bg-white text-civic-600" : "border border-slate-300 bg-white text-slate-400"
                }`}>
                  {checked ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[15px] font-medium leading-5 ${checked ? "text-slate-400 line-through decoration-slate-400/70" : "text-slate-900"}`}>
                    {step}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{subtitle}</span>
                </span>
              </button>
            );
          })}
        </section>

        <div className="grid gap-3 pt-8">
          <PrimaryButton href={replyHref} icon={<MessageSquareText className="h-5 w-5" />}>
            {t.checklist.replyBtn(Boolean(replyDraft))}
          </PrimaryButton>
          {scanId ? (
            <Link href={getScanExportHref(scanId)} className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-[15px] font-semibold text-slate-800 shadow-soft active:scale-[0.99]">
              <Download className="h-5 w-5 text-civic-600" />
              {t.checklist.exportBtn}
            </Link>
          ) : null}
          <Link href="/reminder" className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-[15px] font-semibold text-slate-800 shadow-soft active:scale-[0.99]">
            <Bell className="h-5 w-5 text-civic-600" />
            {t.checklist.reminderBtn}
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function PaymentTaskCard({
  amount,
  amountCents,
  authorityLink,
  category,
  copiedField,
  deadline,
  iban,
  mpowerPaymentState,
  onConfirmPayment,
  onCopy,
  onTryMpowerPayment,
  paymentConfirmed,
  referenceNumber,
  scanId,
  sourceExcerpt,
  submitting,
}: {
  amount: string | null;
  amountCents: number | null;
  authorityLink: { label: string; url: string } | null;
  category: string;
  copiedField: "iban" | "reference" | null;
  deadline: string | null;
  iban: string | null;
  mpowerPaymentState: MpowerPaymentState;
  onConfirmPayment: () => Promise<void>;
  onCopy: (field: "iban" | "reference", value: string) => Promise<void>;
  onTryMpowerPayment: () => Promise<void>;
  paymentConfirmed: boolean;
  referenceNumber: string | null;
  scanId?: string;
  sourceExcerpt: string;
  submitting: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <article
      className={`overflow-hidden rounded-xl border bg-white shadow-soft ${
        paymentConfirmed
          ? "border-emerald-200 bg-emerald-50/40"
          : "border-amber-200 border-l-4 border-l-amber-500"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="touch-target flex w-full items-start gap-3 p-4 text-left active:scale-[0.99]"
      >
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            paymentConfirmed
              ? "bg-emerald-600 text-white"
              : "border border-amber-500 bg-white text-amber-600"
          }`}
        >
          {paymentConfirmed ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <CreditCard className="h-3.5 w-3.5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block text-[15px] font-semibold leading-5 ${
              paymentConfirmed
                ? "text-emerald-800 line-through decoration-emerald-600/50"
                : "text-slate-950"
            }`}
          >
            Pay the requested fee
          </span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">
            {amount ? `${amount}${deadline ? ` · due ${deadline}` : ""}` : "Payment details were detected in the letter"}
          </span>
        </span>
        <ChevronDown
          className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-amber-100 px-4 pb-4 pt-3">
          <div className="rounded-2xl bg-amber-50 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
              Check before paying
            </p>
            <p className="mt-1 text-xs leading-5 text-amber-800">
              Compare amount, IBAN, and reference with the original letter before
              sending money. AmtBrief AI does not transfer funds to the authority.
            </p>
          </div>

          {amount ? (
            <PaymentInfoRow label="Amount" value={amount} />
          ) : null}
          {iban ? (
            <PaymentCopyRow
              copied={copiedField === "iban"}
              label="IBAN"
              value={iban}
              onCopy={() => onCopy("iban", iban)}
            />
          ) : (
            <PaymentInfoRow
              label="IBAN"
              value="Not safely detected - check the original letter before paying"
            />
          )}
          {referenceNumber ? (
            <PaymentCopyRow
              copied={copiedField === "reference"}
              label="Reference"
              value={referenceNumber}
              onCopy={() => onCopy("reference", referenceNumber)}
            />
          ) : null}

          {sourceExcerpt ? (
            <details className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                Why this task appears
              </summary>
              <p className="mt-2 text-xs italic leading-5 text-slate-600">
                &ldquo;{sourceExcerpt}&rdquo;
              </p>
            </details>
          ) : null}

          {authorityLink ? (
            <a
              href={authorityLink.url}
              target="_blank"
              rel="noopener noreferrer"
              className="touch-target flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-civic-700"
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 shrink-0" />
                {authorityLink.label}
              </span>
            </a>
          ) : null}

          {amountCents && scanId ? (
            <div className="rounded-2xl border border-dashed border-civic-300 bg-civic-50 p-3">
              <div className="flex items-start gap-2">
                <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-civic-700" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-civic-700">
                    SuperApp payment
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">
                    Creates a platform payment transaction for this app. Use the
                    IBAN transfer above for paying the authority unless your
                    operator has enabled real bill settlement.
                  </p>
                </div>
              </div>

              {mpowerPaymentState.status === "created" ? (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-mint px-3 py-2 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Transaction created ({mpowerPaymentState.transactionId.slice(0, 8)}...) -
                  check SuperApp.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onTryMpowerPayment}
                  disabled={mpowerPaymentState.status === "creating"}
                  className="touch-target mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-civic-300 bg-white px-3 py-2.5 text-xs font-semibold text-civic-700 disabled:opacity-60"
                >
                  {mpowerPaymentState.status === "creating"
                    ? "Creating payment..."
                    : "Create SuperApp payment"}
                </button>
              )}

              {mpowerPaymentState.status === "error" ? (
                <p className="mt-2 text-[11px] leading-4 text-rose-600">
                  {mpowerPaymentState.message}
                </p>
              ) : null}
            </div>
          ) : null}

          {paymentConfirmed ? (
            <div className="flex items-center gap-2 rounded-xl bg-mint px-3 py-2.5 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Marked as paid
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void onConfirmPayment()}
              disabled={submitting}
              className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-xl bg-civic-600 px-5 py-3 text-[15px] font-semibold text-white shadow-action transition active:scale-[0.99] disabled:opacity-60"
            >
              {submitting ? "Saving..." : "I've paid this"}
            </button>
          )}

          <p className="text-[11px] leading-4 text-slate-400">
            Related letter: {category}
          </p>
        </div>
      ) : null}
    </article>
  );
}

function PaymentInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function PaymentCopyRow({
  copied,
  label,
  onCopy,
  value,
}: {
  copied: boolean;
  label: string;
  onCopy: () => void;
  value: string;
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
        className="touch-target inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-civic-700 active:scale-[0.97]"
      >
        <Copy className="h-3.5 w-3.5" />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function RiskChip({ risk, t }: { risk: RiskLevel; t: T }) {
  const style =
    risk === "high" ? "bg-roseSoft text-rose-700" :
    risk === "medium" ? "bg-amberSoft text-amber-700" :
    "bg-mint text-emerald-700";
  const label =
    risk === "high" ? t.checklist.risk_high :
    risk === "medium" ? t.checklist.risk_medium :
    t.checklist.risk_low;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold ${style}`}>
      <ShieldAlert className="h-3 w-3" />{label}
    </span>
  );
}

function getTaskSubtitle(step: string, index: number, checked: boolean, t: T): string {
  if (checked) return t.checklist.subtitleDone;
  const text = step.toLowerCase();
  if (text.includes("pass") || text.includes("foto") || text.includes("versicherung") || text.includes("mietvertrag") ||
      text.includes("vermieter") || text.includes("einkommens") || text.includes("immatrikulation") ||
      text.includes("passport") || text.includes("photo") || text.includes("insurance") ||
      text.includes("rental") || text.includes("landlord") || text.includes("income") || text.includes("enrollment")) {
    return t.checklist.subtitleDoc;
  }
  if (text.includes("antwort") || text.includes("reply") || text.includes("schreiben") || text.includes("senden")) {
    return t.checklist.subtitleReply;
  }
  if (text.includes("termin") || text.includes("kontakt") || text.includes("appointment") || text.includes("contact")) {
    return t.checklist.subtitleAppointment;
  }
  if (text.includes("kopie") || text.includes("unterlagen") || text.includes("copy") || text.includes("record")) {
    return t.checklist.subtitleRecord;
  }
  return index === 0 ? t.checklist.subtitleFirst : t.checklist.subtitleDefault;
}

function readPaymentDone(scanId?: string) {
  if (!scanId || typeof window === "undefined") return false;
  return window.localStorage.getItem(getPaymentDoneKey(scanId)) === "true";
}

function writePaymentDone(scanId: string | undefined, value: boolean) {
  if (!scanId || typeof window === "undefined") return;
  window.localStorage.setItem(getPaymentDoneKey(scanId), value ? "true" : "false");
}

function getPaymentDoneKey(scanId: string) {
  return `amtbrief-payment-done-${scanId}`;
}
