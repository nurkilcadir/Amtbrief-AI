"use client";

import { useParams } from "next/navigation";
import { ExportPackView } from "@/components/ExportPackView";
import { ScanRouteState, useRoutedScan } from "@/components/ScanRouteGuard";
import { useAmtBrief } from "@/components/AmtBriefProvider";

export default function ScanExportPage() {
  const scanId = useRouteScanId();
  const { analysis } = useAmtBrief();
  const { isActive, scan } = useRoutedScan(scanId);

  if (!scan) {
    return <ScanRouteState kind="missing" title="Visit Pack" />;
  }

  if (!isActive || !analysis) {
    return <ScanRouteState kind="loading" title="Visit Pack" />;
  }

  return <ExportPackView scan={scan} />;
}

function useRouteScanId() {
  const params = useParams<{ scanId?: string | string[] }>();
  const value = params.scanId;
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
