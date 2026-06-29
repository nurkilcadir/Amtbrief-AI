"use client";

import { useParams } from "next/navigation";
import { ChecklistView } from "@/components/ChecklistView";
import { ScanRouteState, useRoutedScan } from "@/components/ScanRouteGuard";
import { useAmtBrief } from "@/components/AmtBriefProvider";

export default function ScanChecklistPage() {
  const scanId = useRouteScanId();
  const { analysis } = useAmtBrief();
  const { isActive, scan } = useRoutedScan(scanId);

  if (!scan) {
    return <ScanRouteState kind="missing" title="Checklist" />;
  }

  if (!isActive || !analysis) {
    return <ScanRouteState kind="loading" title="Checklist" />;
  }

  return <ChecklistView scanId={scan.id} />;
}

function useRouteScanId() {
  const params = useParams<{ scanId?: string | string[] }>();
  const value = params.scanId;
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
