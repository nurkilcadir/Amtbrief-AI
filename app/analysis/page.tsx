"use client";

import { useEffect, useRef } from "react";
import {
  AlertTriangle,
  FileText,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DocumentOverview } from "@/components/DocumentOverview";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useAmtBrief } from "@/components/AmtBriefProvider";

export default function AnalysisPage() {
  const {
    analysis,
    analysisStatus,
    sourceLabel,
    activeScanId,
    scanHistory,
    documentFile,
    documentText,
    analyzeCurrentDocument,
    error,
  } = useAmtBrief();
  const started = useRef(false);
  const hasPendingDocument = Boolean(documentText.trim()) || Boolean(documentFile);

  useEffect(() => {
    if (started.current || analysis || !hasPendingDocument) return;
    started.current = true;
    void analyzeCurrentDocument();
  }, [analysis, analyzeCurrentDocument, hasPendingDocument]);

  const isLoading =
    analysisStatus === "loading" ||
    (analysisStatus === "idle" && !analysis && hasPendingDocument);
  const activeScan =
    activeScanId ? scanHistory.find((scan) => scan.id === activeScanId) : null;

  return (
    <AppShell
      title={analysis && !isLoading ? "Document Summary" : "AI analysis"}
      eyebrow="AmtBrief AI"
    >
      {!hasPendingDocument && !analysis ? <EmptyAnalysis /> : null}

      {hasPendingDocument && isLoading ? (
        <div className="space-y-4">
          <section className="app-card p-5">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-civic-100 text-civic-700">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-civic-700">
              Analyzing document
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ink">Reading the letter</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              AmtBrief AI is detecting category, risk, deadline, documents, and
              the next action.
            </p>
          </section>
          <LoadingSkeleton />
        </div>
      ) : null}

      {analysisStatus === "error" ? (
        <section className="app-card p-5">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-roseSoft text-rose-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold text-ink">Analysis needs a retry</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{error}</p>
          <div className="mt-4 grid gap-3">
            <SecondaryButton onClick={() => void analyzeCurrentDocument()}>
              Try again
            </SecondaryButton>
            <PrimaryButton href="/input">Choose another input</PrimaryButton>
          </div>
        </section>
      ) : null}

      {analysis && !isLoading ? (
        <DocumentOverview
          analysis={analysis}
          checklistCompleted={activeScan?.checklistCompleted}
          createdAt={activeScan?.createdAt}
          inputType={activeScan?.inputType}
          reminderStatus={activeScan?.reminderStatus}
          scanId={activeScanId}
          sourceLabel={sourceLabel}
        />
      ) : null}
    </AppShell>
  );
}

function EmptyAnalysis() {
  return (
    <section className="app-card p-5">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-civic-100 text-civic-700">
        <FileText className="h-6 w-6" />
      </div>
      <h2 className="text-xl font-semibold text-ink">No letter yet</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Paste a German official letter or choose an example letter to start an
        analysis.
      </p>
      <div className="mt-5">
        <PrimaryButton href="/input">Add a letter</PrimaryButton>
      </div>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((item) => (
        <div key={item} className="app-card-subtle p-4">
          <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-4 h-5 w-full animate-pulse rounded-full bg-slate-100" />
          <div className="mt-2 h-5 w-4/5 animate-pulse rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
