"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ScanOverviewPage() {
  const router = useRouter();
  const params = useParams<{ scanId?: string | string[] }>();
  const value = params.scanId;
  const scanId = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

  useEffect(() => {
    if (scanId) {
      router.replace(`/scans/${scanId}/checklist`);
    } else {
      router.replace("/scans");
    }
  }, [scanId, router]);

  return null;
}
