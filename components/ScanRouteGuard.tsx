"use client";

import { useEffect } from "react";
import { FileText, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAmtBrief } from "@/components/AmtBriefProvider";

export function useRoutedScan(scanId: string) {
  const { activeScanId, scanHistory, selectScan } = useAmtBrief();
  const scan = scanHistory.find((item) => item.id === scanId) ?? null;
  const isActive = Boolean(scan && activeScanId === scan.id);

  useEffect(() => {
    if (!scan || isActive) return;
    selectScan(scan.id);
  }, [isActive, scan, selectScan]);

  return {
    isActive,
    scan,
  };
}

export function ScanRouteState({
  kind,
  title = "Document Summary",
}: {
  kind: "loading" | "missing";
  title?: string;
}) {
  if (kind === "loading") {
    return (
      <AppShell title={title} eyebrow="AmtBrief AI">
        <section className="app-card p-5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-civic-100 text-civic-700">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-ink">Opening scan</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Loading the selected document details.
          </p>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell title={title} eyebrow="AmtBrief AI">
      <section className="app-card p-5">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-civic-100 text-civic-700">
          <FileText className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-ink">Scan not found</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This document is not saved on this device. Open My Scans or analyze a
          new letter.
        </p>
        <div className="mt-5">
          <PrimaryButton href="/scans">Back to My Scans</PrimaryButton>
        </div>
      </section>
    </AppShell>
  );
}
