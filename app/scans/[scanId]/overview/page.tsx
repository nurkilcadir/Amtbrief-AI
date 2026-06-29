"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DocumentOverview } from "@/components/DocumentOverview";
import { ScanRouteState, useRoutedScan } from "@/components/ScanRouteGuard";
import { useAmtBrief } from "@/components/AmtBriefProvider";

export default function ScanOverviewPage() {
  const scanId = useRouteScanId();
  const { analysis, sourceLabel } = useAmtBrief();
  const { isActive, scan } = useRoutedScan(scanId);

  if (!scan) {
    return <ScanRouteState kind="missing" />;
  }

  if (!isActive || !analysis) {
    return <ScanRouteState kind="loading" />;
  }

  return (
    <AppShell title="Document Summary" eyebrow="AmtBrief AI">
      <DocumentOverview analysis={analysis} scanId={scan.id} sourceLabel={sourceLabel} />
    </AppShell>
  );
}

function useRouteScanId() {
  const params = useParams<{ scanId?: string | string[] }>();
  const value = params.scanId;
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
