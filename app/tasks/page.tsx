"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAmtBrief } from "@/components/AmtBriefProvider";

export default function TasksPage() {
  const router = useRouter();
  const { activeScanId } = useAmtBrief();

  useEffect(() => {
    if (activeScanId) {
      router.replace(`/scans/${activeScanId}/checklist`);
    } else {
      router.replace("/scans");
    }
  }, [activeScanId, router]);

  return null;
}
