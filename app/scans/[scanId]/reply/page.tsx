"use client";

import { useParams } from "next/navigation";
import { ReplyView } from "@/components/ReplyView";
import { ScanRouteState, useRoutedScan } from "@/components/ScanRouteGuard";
import { useAmtBrief } from "@/components/AmtBriefProvider";

export default function ScanReplyPage() {
  const scanId = useRouteScanId();
  const { analysis } = useAmtBrief();
  const { isActive, scan } = useRoutedScan(scanId);

  if (!scan) {
    return <ScanRouteState kind="missing" title="German reply" />;
  }

  if (!isActive || !analysis) {
    return <ScanRouteState kind="loading" title="German reply" />;
  }

  return <ReplyView scanId={scan.id} />;
}

function useRouteScanId() {
  const params = useParams<{ scanId?: string | string[] }>();
  const value = params.scanId;
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
