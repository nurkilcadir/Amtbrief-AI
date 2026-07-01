import { getScanSectionHref } from "@/lib/routes";
import type { RiskLevel } from "@/lib/types";

export function getTaskRisk(step: string, overallRisk: RiskLevel): RiskLevel {
  const text = step.toLowerCase();

  if (overallRisk === "high") {
    return "high";
  }

  if (
    text.includes("passport") ||
    text.includes("insurance") ||
    text.includes("rental") ||
    text.includes("income") ||
    text.includes("appointment") ||
    text.includes("deadline") ||
    text.includes("frist")
  ) {
    return "high";
  }

  if (text.includes("reply") || text.includes("send") || text.includes("contact")) {
    return "medium";
  }

  return overallRisk;
}

export function getTaskHref(scanId: string, step: string) {
  const text = step.toLowerCase();

  if (text.includes("reply") || text.includes("send")) {
    return getScanSectionHref(scanId, "reply");
  }

  if (text.includes("reminder")) {
    return "/reminder";
  }

  return getScanSectionHref(scanId, "checklist");
}
