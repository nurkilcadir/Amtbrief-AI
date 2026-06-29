import { RiskLevel } from "@/lib/types";

export type DeadlineType = "exclusionary" | "extendable" | "none";

export type ConsequenceSeverity =
  | "financial_penalty"
  | "status_loss"
  | "rejection"
  | "delay_only"
  | "informational";

/**
 * Base risk per consequence, mirroring how German authorities actually
 * escalate: a Bußgeld or loss of legal status outranks a routine
 * "Verzögerung" or a purely informational notice.
 */
const severityBaseRisk: Record<ConsequenceSeverity, RiskLevel> = {
  financial_penalty: "high",
  status_loss: "high",
  rejection: "medium",
  delay_only: "medium",
  informational: "low",
};

const proximityBumpThresholdDays = 3;

function bumpRisk(risk: RiskLevel): RiskLevel {
  return risk === "low" ? "medium" : "high";
}

export function getDaysUntilDeadline(deadlineIso: string | null): number | null {
  if (!deadlineIso) return null;

  const target = new Date(deadlineIso);
  if (Number.isNaN(target.getTime())) return null;

  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  return Math.round((startOfTarget.getTime() - startOfToday.getTime()) / msPerDay);
}

/**
 * Derives risk_level deterministically instead of trusting the model's own
 * high/medium/low guess. An exclusionary (Ausschlussfrist-like) deadline
 * always escalates risk, since missing it cannot be undone - independent of
 * how many days remain. A deadline of any type that is imminent or already
 * passed escalates risk too, since "extendable" only matters if there is
 * still time to ask for an extension.
 */
export function deriveRiskLevel(input: {
  consequenceSeverity: ConsequenceSeverity;
  deadlineType: DeadlineType;
  deadlineIso: string | null;
}): RiskLevel {
  let risk = severityBaseRisk[input.consequenceSeverity] ?? "medium";

  if (input.deadlineType === "exclusionary") {
    risk = bumpRisk(risk);
  }

  const daysUntil = getDaysUntilDeadline(input.deadlineIso);
  if (daysUntil !== null && daysUntil <= proximityBumpThresholdDays) {
    risk = bumpRisk(risk);
  }

  return risk;
}
