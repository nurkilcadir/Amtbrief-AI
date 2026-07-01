"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileText,
  Landmark,
  ShieldAlert,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { buildOverviewModel, OverviewModel } from "@/lib/overview";
import { getScanSectionHref } from "@/lib/routes";
import type { ScanRecord } from "@/lib/types";

export function ExportPackView({ scan }: { scan: ScanRecord }) {
  const [copied, setCopied] = useState(false);
  const overview = buildOverviewModel(scan.analysis, {
    checklistCompleted: scan.checklistCompleted,
    createdAt: scan.createdAt,
    inputType: scan.inputType,
    sourceLabel: scan.sourceLabel,
  });
  const printableText = useMemo(
    () => buildPlainTextPack(scan, overview),
    [scan, overview],
  );

  function saveAsPdf() {
    window.print();
  }

  async function copyPack() {
    try {
      await navigator.clipboard.writeText(printableText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <AppShell title="Visit Pack" eyebrow="AmtBrief AI">
      <div className="space-y-4">
        <section className="no-print app-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-civic-100 text-civic-700">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-ink">
                Behörden-Mappe
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Save a concise preparation pack for an appointment, document
                submission, or phone call with the authority.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={saveAsPdf}
              className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-xl bg-civic-600 px-5 py-3 text-[15px] font-semibold text-white shadow-action active:scale-[0.99]"
            >
              Save as PDF
              <Download className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={copyPack}
              className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-[15px] font-semibold text-slate-800 shadow-soft active:scale-[0.99]"
            >
              {copied ? "Copied" : "Copy text"}
              <ClipboardCopy className="h-5 w-5 text-civic-600" />
            </button>
            <Link
              href={getScanSectionHref(scan.id, "overview")}
              className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold text-slate-500 active:bg-slate-100"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to overview
            </Link>
          </div>
        </section>

        <article className="print-page space-y-4 rounded-[20px] border border-slate-200 bg-white p-5 shadow-soft">
          <header className="border-b border-slate-200 pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-civic-700">
              AmtBrief AI
            </p>
            <h2 className="mt-1 text-2xl font-bold leading-tight text-ink">
              Behörden-Mappe
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Persönliche Vorbereitung für Termin, Abgabe oder Rückfrage. Diese
              Übersicht ist keine Rechtsberatung und kein offizielles Dokument.
            </p>
          </header>

          <section className="grid gap-3">
            <ExportRow
              icon={<Landmark className="h-4 w-4" />}
              label="Kurum"
              value={overview.authority.label}
            />
            <ExportRow
              icon={<FileText className="h-4 w-4" />}
              label="Vorgang"
              value={scan.analysis.category}
            />
            <ExportRow
              icon={<ShieldAlert className="h-4 w-4" />}
              label="Priorität"
              value={`${overview.priority.label} (${scan.analysis.risk_level})`}
            />
            <ExportRow
              icon={<CalendarDays className="h-4 w-4" />}
              label="Frist / Termin"
              value={scan.analysis.deadline ?? "Keine eindeutige Frist erkannt"}
            />
            {scan.analysis.reference_number ? (
              <ExportRow
                icon={<FileText className="h-4 w-4" />}
                label="Aktenzeichen / Referenz"
                value={scan.analysis.reference_number}
              />
            ) : null}
            <ExportRow
              icon={<CalendarDays className="h-4 w-4" />}
              label="Erstellt"
              value={formatDate(scan.createdAt)}
            />
          </section>

          <PackSection title="Worum geht es?">
            <p className="text-sm leading-6 text-slate-700">{scan.analysis.summary}</p>
            <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Empfohlener nächster Schritt
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-800">
                {scan.analysis.recommended_next_step}
              </p>
            </div>
          </PackSection>

          <PackSection title="Mitzubringende Unterlagen">
            {scan.analysis.required_documents.length > 0 ? (
              <ul className="space-y-2">
                {scan.analysis.required_documents.map((document) => (
                  <li key={document} className="flex gap-2 text-sm leading-6 text-slate-700">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{document}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm leading-6 text-slate-600">
                Im Schreiben wurde keine konkrete Dokumentenliste erkannt.
                Originalbrief trotzdem mitnehmen.
              </p>
            )}
          </PackSection>

          <PackSection title="Checkliste">
            <ol className="space-y-2">
              {scan.analysis.checklist.map((step, index) => {
                const done = !!scan.checklistCompleted[index];

                return (
                  <li
                    key={`${step}-${index}`}
                    className="grid grid-cols-[24px_1fr] gap-2 text-sm leading-6 text-slate-700"
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold ${
                        done
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-300 text-slate-500"
                      }`}
                    >
                      {done ? "✓" : index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                );
              })}
            </ol>
          </PackSection>

          {overview.payment.visible ? (
            <PackSection title="Zahlungsdaten aus dem Schreiben">
              <div className="space-y-2 text-sm leading-6 text-slate-700">
                {overview.payment.amount ? (
                  <p>
                    <strong>Betrag:</strong> {overview.payment.amount}
                  </p>
                ) : null}
                <p>
                  <strong>IBAN:</strong> {overview.payment.iban}
                </p>
                {overview.payment.referenceNumber ? (
                  <p>
                    <strong>Verwendungszweck:</strong>{" "}
                    {overview.payment.referenceNumber}
                  </p>
                ) : null}
                <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  Vor einer Überweisung Betrag, IBAN und Verwendungszweck mit
                  dem Originalbrief abgleichen.
                </p>
              </div>
            </PackSection>
          ) : null}

          {scan.replyDraft ? (
            <PackSection title="Antwortentwurf">
              <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
                {scan.replyDraft}
              </div>
            </PackSection>
          ) : null}

          <PackSection title="Quelle im Originalbrief">
            <p className="text-sm italic leading-6 text-slate-600">
              “{scan.analysis.source_excerpt}”
            </p>
          </PackSection>

          <footer className="border-t border-slate-200 pt-4 text-[11px] leading-5 text-slate-500">
            AmtBrief AI hilft beim Verstehen und Vorbereiten von Unterlagen. Es
            ersetzt keine Rechtsberatung. Bitte Angaben immer mit dem
            Originalschreiben abgleichen.
          </footer>
        </article>
      </div>
    </AppShell>
  );
}

function ExportRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[24px_112px_1fr] gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 text-sm">
      <span className="mt-0.5 text-civic-700">{icon}</span>
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function PackSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="break-inside-avoid rounded-2xl border border-slate-200 p-4">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-civic-700">
        {title}
      </h3>
      {children}
    </section>
  );
}

function buildPlainTextPack(scan: ScanRecord, overview: OverviewModel) {
  const analysis = scan.analysis;
  const lines = [
    "AmtBrief AI - Behörden-Mappe",
    "Persönliche Vorbereitung. Keine Rechtsberatung.",
    "",
    `Kurum: ${overview.authority.label}`,
    `Vorgang: ${analysis.category}`,
    `Priorität: ${overview.priority.label} (${analysis.risk_level})`,
    `Frist / Termin: ${analysis.deadline ?? "Keine eindeutige Frist erkannt"}`,
    analysis.reference_number
      ? `Aktenzeichen / Referenz: ${analysis.reference_number}`
      : null,
    `Erstellt: ${formatDate(scan.createdAt)}`,
    "",
    "Worum geht es?",
    analysis.summary,
    "",
    "Empfohlener nächster Schritt",
    analysis.recommended_next_step,
    "",
    "Mitzubringende Unterlagen",
    ...(analysis.required_documents.length
      ? analysis.required_documents.map((document) => `- ${document}`)
      : ["- Originalbrief mitnehmen"]),
    "",
    "Checkliste",
    ...analysis.checklist.map((step, index) => {
      const marker = scan.checklistCompleted[index] ? "x" : " ";
      return `${index + 1}. [${marker}] ${step}`;
    }),
    overview.payment.visible ? "" : null,
    overview.payment.visible ? "Zahlungsdaten aus dem Schreiben" : null,
    overview.payment.amount ? `Betrag: ${overview.payment.amount}` : null,
    overview.payment.visible ? `IBAN: ${overview.payment.iban}` : null,
    overview.payment.referenceNumber
      ? `Verwendungszweck: ${overview.payment.referenceNumber}`
      : null,
    "",
    "Quelle im Originalbrief",
    analysis.source_excerpt,
  ];

  return lines.filter((line): line is string => line !== null).join("\n");
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Heute";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
