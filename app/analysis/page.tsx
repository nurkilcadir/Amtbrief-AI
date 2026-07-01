"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useAmtBrief } from "@/components/AmtBriefProvider";
import { useLang } from "@/components/LanguageProvider";

export default function AnalysisPage() {
  const router = useRouter();
  const { t } = useLang();
  const {
    analysis,
    analysisStatus,
    activeScanId,
    documentFile,
    documentText,
    analyzeCurrentDocument,
    error,
  } = useAmtBrief();
  const started = useRef(false);
  const hasPendingDocument = Boolean(documentText.trim()) || Boolean(documentFile);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (started.current || analysis || !hasPendingDocument) return;
    started.current = true;
    void analyzeCurrentDocument();
  }, [analysis, analyzeCurrentDocument, hasPendingDocument]);

  useEffect(() => {
    if (analysisStatus !== "loading") return;
    const interval = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, t.analysis.loadingMessages.length - 1));
    }, 2200);
    return () => clearInterval(interval);
  }, [analysisStatus, t.analysis.loadingMessages.length]);

  useEffect(() => {
    if (analysisStatus === "ready" && activeScanId) {
      router.replace(`/scans/${activeScanId}/checklist`);
    }
  }, [analysisStatus, activeScanId, router]);

  const isLoading =
    analysisStatus === "loading" ||
    (analysisStatus === "idle" && !analysis && hasPendingDocument);

  return (
    <AppShell title={t.analysis.pageTitle} eyebrow="AmtBrief AI">
      {!hasPendingDocument && !analysis ? (
        <section className="app-card p-5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-civic-100 text-civic-700">
            <FileText className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold text-ink">{t.analysis.emptyTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{t.analysis.emptySubtitle}</p>
          <div className="mt-5">
            <PrimaryButton href="/input">{t.analysis.emptyBtn}</PrimaryButton>
          </div>
        </section>
      ) : null}

      {hasPendingDocument && isLoading ? (
        <div className="space-y-4">
          <section className="app-card p-5">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-civic-100 text-civic-700">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-civic-700">
              {t.analysis.loadingLabel}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ink">
              {t.analysis.loadingMessages[messageIndex]}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{t.analysis.loadingSubtitle}</p>
          </section>
          <LoadingSkeleton />
        </div>
      ) : null}

      {analysisStatus === "error" ? (
        <section className="app-card p-5">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-roseSoft text-rose-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold text-ink">{t.analysis.errorTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{error}</p>
          <div className="mt-4 grid gap-3">
            <SecondaryButton onClick={() => void analyzeCurrentDocument()}>{t.analysis.retry}</SecondaryButton>
            <PrimaryButton href="/input">{t.analysis.changeInput}</PrimaryButton>
          </div>
        </section>
      ) : null}
    </AppShell>
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
