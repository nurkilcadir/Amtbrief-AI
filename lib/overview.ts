import { getDaysUntilDeadline } from "@/lib/risk";
import {
  AnalysisInputType,
  AnalysisResult,
  AuthorityType,
  Confidence,
  ConsequenceSeverity,
  DeadlineType,
  RiskLevel,
} from "@/lib/types";

/**
 * Only authorities with one reliable, nationwide official portal get a link -
 * most German authorities (Bürgeramt, Ausländerbehörde, vehicle registration)
 * are city/Landkreis-specific with no single correct URL, so showing one
 * would risk pointing the user at the wrong city's site.
 */
const authorityLinks: Partial<Record<AuthorityType, { label: string; url: string }>> = {
  finanzamt: { label: "Open ELSTER (official tax portal)", url: "https://www.elster.de" },
  jobcenter: {
    label: "Open Bundesagentur für Arbeit",
    url: "https://www.arbeitsagentur.de",
  },
  university_bafog: { label: "Open BAföG portal", url: "https://www.bafög.de" },
};

function getAuthorityLink(authorityType: AuthorityType) {
  return authorityLinks[authorityType] ?? null;
}

/**
 * Parses German-formatted amounts ("500 Euro", "47,30 EUR", "1.234,56 €")
 * into integer cents for the mPower transaction API, which requires amount
 * as an integer. Returns null when the text has no parseable number.
 */
function parseAmountToCents(text: string | null) {
  if (!text) return null;

  const cleaned = text.replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return null;

  const hasDecimalComma = /,\d{1,2}$/.test(cleaned);
  const normalized = hasDecimalComma
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/,/g, "");

  const value = Number.parseFloat(normalized);
  return Number.isNaN(value) ? null : Math.round(value * 100);
}

export type OverviewTone = "neutral" | "calm" | "warning" | "danger";

export type OverviewScanMeta = {
  checklistCompleted?: Record<number, boolean>;
  createdAt?: string | null;
  inputType?: AnalysisInputType | null;
  sourceLabel?: string;
};

export type OverviewModel = {
  action: {
    detail: string;
    label: string;
    tone: OverviewTone;
  };
  authority: {
    label: string;
    source: "detected" | "fallback";
  };
  checklist: {
    completedCount: number;
    label: string;
    remainingCount: number;
    totalCount: number;
  };
  confidence: {
    label: string;
    tone: OverviewTone;
  };
  deadline: {
    detail: string;
    evidence: string | null;
    label: string;
    relativeLabel: string;
    tone: OverviewTone;
    typeLabel: string;
  };
  documents: {
    hiddenCount: number;
    label: string;
    preview: string[];
    totalCount: number;
  };
  payment: {
    amount: string | null;
    amountCents: number | null;
    authorityLink: { label: string; url: string } | null;
    iban: string | null;
    referenceNumber: string | null;
    visible: boolean;
  };
  priority: {
    description: string;
    label: string;
    reason: string;
    risk: RiskLevel;
  };
  receivedLabel: string;
  sourceLabel: string;
  sourceTypeLabel: string;
};

export function buildOverviewModel(
  analysis: AnalysisResult,
  meta: OverviewScanMeta = {},
): OverviewModel {
  const sourceLabel = meta.sourceLabel?.trim() || "Official letter";
  const daysUntil = getDaysUntilDeadline(analysis.deadline_iso);
  const authority = inferAuthority(
    `${analysis.category} ${sourceLabel} ${analysis.source_excerpt}`,
  );
  const checklist = getChecklistMeta(analysis.checklist, meta.checklistCompleted);
  const documents = getDocumentMeta(analysis.required_documents);

  return {
    action: getActionMeta(analysis, documents.totalCount, checklist.remainingCount),
    authority,
    checklist,
    confidence: getConfidenceMeta(analysis.confidence),
    deadline: getDeadlineMeta(
      analysis.deadline,
      analysis.deadline_type,
      daysUntil,
      analysis.deadline_evidence,
    ),
    documents,
    payment: {
      amount: analysis.payment_amount,
      amountCents: parseAmountToCents(analysis.payment_amount),
      authorityLink: getAuthorityLink(analysis.authority_type),
      iban: analysis.payment_iban,
      referenceNumber: analysis.reference_number,
      visible:
        analysis.payment_needed ||
        analysis.document_type === "payment_request" ||
        analysis.required_action_type === "pay" ||
        Boolean(analysis.payment_amount) ||
        Boolean(analysis.payment_iban),
    },
    priority: getPriorityMeta(
      analysis.risk_level,
      analysis.consequence_severity,
      analysis.deadline_type,
      daysUntil,
    ),
    receivedLabel: formatAnalyzedDate(meta.createdAt),
    sourceLabel,
    sourceTypeLabel: getSourceTypeLabel(meta.inputType),
  };
}

function getPriorityMeta(
  risk: RiskLevel,
  consequenceSeverity: ConsequenceSeverity,
  deadlineType: DeadlineType,
  daysUntil: number | null,
) {
  const consequenceReason = getConsequenceReason(consequenceSeverity);
  const deadlineReason = getDeadlineReason(deadlineType, daysUntil);
  const reason = [consequenceReason, deadlineReason].filter(Boolean).join(" ");

  if (risk === "high") {
    return {
      risk,
      label: "High priority",
      description:
        "Handle this before other paperwork. The detected consequence or deadline can create a serious problem if missed.",
      reason,
    };
  }

  if (risk === "medium") {
    return {
      risk,
      label: "Action required",
      description:
        "This needs a concrete next step, but the detected consequence is usually manageable if you act in time.",
      reason,
    };
  }

  return {
    risk,
    label: "Low priority",
    description:
      "No immediate penalty or status risk was detected. Keep the letter and follow the suggested step if relevant.",
    reason,
  };
}

function getDeadlineMeta(
  deadline: string | null,
  deadlineType: DeadlineType,
  daysUntil: number | null,
  deadlineEvidence: string | null,
) {
  const label = isUsefulDeadline(deadline) ? deadline! : "No exact deadline";
  const typeLabel = getDeadlineTypeLabel(deadlineType);
  const detail = getDeadlineDetail(deadlineType);
  const evidence = deadlineEvidence?.trim() || null;

  if (daysUntil !== null && daysUntil < 0) {
    return {
      label,
      relativeLabel: "This date has passed",
      typeLabel,
      detail,
      evidence,
      tone: "danger" as const,
    };
  }

  if (daysUntil === 0) {
    return {
      label,
      relativeLabel: "Due today",
      typeLabel,
      detail,
      evidence,
      tone: "danger" as const,
    };
  }

  if (daysUntil !== null && daysUntil <= 3) {
    return {
      label,
      relativeLabel: `In ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
      typeLabel,
      detail,
      evidence,
      tone: "warning" as const,
    };
  }

  if (daysUntil !== null) {
    return {
      label,
      relativeLabel: `In ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
      typeLabel,
      detail,
      evidence,
      tone: deadlineType === "exclusionary" ? ("warning" as const) : ("calm" as const),
    };
  }

  return {
    label,
    relativeLabel:
      deadlineType === "none" ? "No dated deadline detected" : "Deadline needs checking",
    typeLabel,
    detail,
    evidence,
    tone: deadlineType === "none" ? ("neutral" as const) : ("warning" as const),
  };
}

function getActionMeta(
  analysis: AnalysisResult,
  documentCount: number,
  remainingSteps: number,
) {
  if (analysis.consequence_severity === "informational") {
    return {
      label: "Information only",
      detail: "No mandatory response was detected, but keep the letter for records.",
      tone: "calm" as const,
    };
  }

  if (analysis.risk_level === "high") {
    return {
      label: "Act as soon as possible",
      detail:
        remainingSteps > 0
          ? `${remainingSteps} checklist step${remainingSteps === 1 ? "" : "s"} still need attention.`
          : "The checklist is complete; keep proof of what you sent or prepared.",
      tone: "danger" as const,
    };
  }

  if (documentCount > 0) {
    return {
      label: "Prepare documents",
      detail: `${documentCount} required document${documentCount === 1 ? "" : "s"} detected from the letter.`,
      tone: "warning" as const,
    };
  }

  return {
    label: "Reply or confirm",
    detail: "The next step is mainly a written response or appointment confirmation.",
    tone: "neutral" as const,
  };
}

function getDocumentMeta(requiredDocuments: string[]) {
  const documents = requiredDocuments.filter((document) => document.trim());
  const preview = documents.slice(0, 4);

  return {
    hiddenCount: Math.max(0, documents.length - preview.length),
    label:
      documents.length === 0
        ? "No specific documents detected"
        : `${documents.length} document${documents.length === 1 ? "" : "s"} detected`,
    preview,
    totalCount: documents.length,
  };
}

function getChecklistMeta(
  checklist: string[],
  completed: Record<number, boolean> | undefined,
) {
  const totalCount = checklist.length;
  const completedCount = checklist.reduce(
    (count, _, index) => count + (completed?.[index] ? 1 : 0),
    0,
  );
  const remainingCount = Math.max(0, totalCount - completedCount);

  return {
    completedCount,
    label:
      totalCount === 0
        ? "No checklist yet"
        : `${completedCount}/${totalCount} step${totalCount === 1 ? "" : "s"} complete`,
    remainingCount,
    totalCount,
  };
}

function getConfidenceMeta(confidence: Confidence) {
  if (confidence === "high") {
    return {
      label: "High confidence",
      tone: "calm" as const,
    };
  }

  if (confidence === "medium") {
    return {
      label: "Medium confidence",
      tone: "neutral" as const,
    };
  }

  return {
    label: "Needs checking",
    tone: "warning" as const,
  };
}

function getConsequenceReason(consequenceSeverity: ConsequenceSeverity) {
  switch (consequenceSeverity) {
    case "financial_penalty":
      return "The letter indicates a possible fine, fee, or enforcement measure.";
    case "status_loss":
      return "The letter may affect legal status, insurance, benefits, or eligibility.";
    case "rejection":
      return "The letter suggests an application or request could be rejected.";
    case "delay_only":
      return "The main consequence appears to be processing delay.";
    case "informational":
      return "The letter appears mainly informational.";
  }
}

function getDeadlineReason(deadlineType: DeadlineType, daysUntil: number | null) {
  if (deadlineType === "exclusionary") {
    return "The deadline is classified as hard to reverse if missed.";
  }

  if (deadlineType === "extendable") {
    return daysUntil !== null && daysUntil <= 3
      ? "The deadline is close, even if an extension may be possible."
      : "The deadline looks administrative and may be negotiable if requested early.";
  }

  return "";
}

function getDeadlineTypeLabel(deadlineType: DeadlineType) {
  if (deadlineType === "exclusionary") return "Hard legal deadline";
  if (deadlineType === "extendable") return "Administrative deadline";
  return "No fixed deadline";
}

function getDeadlineDetail(deadlineType: DeadlineType) {
  if (deadlineType === "exclusionary") {
    return "Missing this can be difficult or impossible to undo.";
  }

  if (deadlineType === "extendable") {
    return "Usually manageable if you ask for a new date or more time early.";
  }

  return "No explicit due date was found in the document.";
}

function getSourceTypeLabel(inputType: AnalysisInputType | null | undefined) {
  if (inputType === "camera") return "Camera scan";
  if (inputType === "image") return "Uploaded image";
  if (inputType === "pdf") return "PDF upload";
  if (inputType === "example") return "German letter example";
  if (inputType === "text") return "Pasted text";
  return "Document input";
}

function inferAuthority(rawText: string): OverviewModel["authority"] {
  const text = rawText.toLowerCase();

  const matches: Array<[RegExp, string]> = [
    [/(ausländer|aufenthalt|fiktions|immigration)/, "Ausländerbehörde"],
    [/(finanzamt|steuer|einspruch|einkommensteuer|schätzungsbescheid)/, "Finanzamt"],
    [/(jobcenter|bürgergeld|arbeitslosengeld|sozialamt)/, "Jobcenter / Sozialamt"],
    [/(krankenkasse|krankenversicherung|gesundheitskarte)/, "Krankenkasse"],
    [/(bürgeramt|melde|anmeldung|personalausweis|reisepass)/, "Bürgeramt"],
    [/(bafög|universität|hochschule|studierendenwerk)/, "University / BAföG office"],
    [/(zulassung|kfz|fahrzeug|kennzeichen)/, "Vehicle registration office"],
    [/(versicherung|schaden|police)/, "Insurance provider"],
  ];

  const match = matches.find(([pattern]) => pattern.test(text));

  if (match) {
    return {
      label: match[1],
      source: "detected",
    };
  }

  return {
    label: "German authority",
    source: "fallback",
  };
}

function formatAnalyzedDate(createdAt: string | null | undefined) {
  if (!createdAt) return "Analyzed today";

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "Analyzed today";

  const now = new Date();
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round(
    (today.getTime() - dateDay.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (diffDays === 0) return "Analyzed today";
  if (diffDays === 1) return "Analyzed yesterday";

  return `Analyzed ${date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;
}

function isUsefulDeadline(deadline: string | null) {
  return Boolean(deadline && deadline !== "Not clearly detected");
}
