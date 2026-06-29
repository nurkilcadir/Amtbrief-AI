import { AnalysisResult, ConsequenceSeverity, DeadlineType, ReplyTone } from "@/lib/types";
import { deriveRiskLevel } from "@/lib/risk";

export function buildMockAnalysis(letterText: string): AnalysisResult {
  const normalized = letterText.toLowerCase();
  const isImmigration =
    normalized.includes("ausländerbehörde") ||
    normalized.includes("aufenthalt") ||
    normalized.includes("reisepass");

  if (!isImmigration) {
    return {
      category: "German authority letter",
      summary:
        "This appears to be an official letter asking you to react within a defined process. The safest next step is to identify the deadline, collect the requested documents, and answer in writing if anything is unclear.",
      source_excerpt: createSourceExcerpt(letterText),
      required_action:
        "Check the requested documents, confirm the next appointment or deadline, and send a short written reply if you cannot comply exactly as requested.",
      deadline: "Not clearly detected",
      deadline_iso: null,
      deadline_type: "none",
      consequence_severity: "delay_only",
      risk_level: deriveRiskLevel({
        consequenceSeverity: "delay_only",
        deadlineType: "none",
        deadlineIso: null,
      }),
      required_documents: [
        "The original letter",
        "Your ID or passport",
        "Any documents explicitly requested in the letter",
        "Proof or reference number mentioned in the letter",
      ],
      checklist: [
        "Read the letter once and highlight every date, reference number, and requested document.",
        "Collect all documents named in the letter.",
        "Check whether a reply is required before an appointment or deadline.",
        "Draft a short German reply asking for confirmation or more time if needed.",
        "Save a copy of the letter and your reply.",
        "Set a reminder at least three days before the deadline.",
      ],
      recommended_next_step:
        "Paste the most important paragraph again if you want a more specific answer, then prepare a written reply before the deadline.",
      reply_draft_de: buildMockReply(undefined, "neutral"),
      confidence: "medium",
    };
  }

  const immigrationAnalysis: AnalysisResult = {
    category: "Ausländerbehörde - Aufenthaltstitel / missing documents",
    summary:
      "The immigration office is processing an application to extend a residence permit. They need additional documents and have scheduled an appointment. If the documents are incomplete, the decision may be delayed.",
    source_excerpt: createSourceExcerpt(letterText),
    required_action:
      "Attend the appointment or contact the office immediately if the appointment is not possible. Bring the listed documents and keep copies for your records.",
    deadline: "14.08.2026, 09:30",
    deadline_iso: "2026-08-14T09:30:00",
    deadline_type: "extendable",
    consequence_severity: "delay_only",
    risk_level: deriveRiskLevel({
      consequenceSeverity: "delay_only",
      deadlineType: "extendable",
      deadlineIso: "2026-08-14T09:30:00",
    }),
    required_documents: [
      "Valid passport",
      "Current biometric passport photo",
      "Proof of health insurance",
      "Current rental contract or landlord confirmation",
      "Last three months of income proof or certificate of enrollment",
    ],
    checklist: [
      "Save the file number ABH-2026-000471 in your notes.",
      "Check that your passport is valid for the appointment date.",
      "Book or print a current biometric passport photo.",
      "Download or request proof of health insurance.",
      "Prepare your rental contract or landlord confirmation.",
      "Collect income proof for the last three months or your enrollment certificate.",
      "Send a short German reply confirming the appointment or asking for a new date.",
    ],
    recommended_next_step:
      "Prepare the missing documents today and send a short confirmation to the Ausländerbehörde so there is a written record before the appointment.",
    reply_draft_de: "",
    confidence: "high",
  };

  return {
    ...immigrationAnalysis,
    reply_draft_de: buildMockReply(immigrationAnalysis, "polite"),
  };
}

export function buildMockReply(
  analysis?: Pick<AnalysisResult, "deadline" | "required_documents">,
  tone: ReplyTone = "neutral",
) {
  const greeting = "Sehr geehrte Damen und Herren,";
  const intro =
    tone === "urgent"
      ? "vielen Dank für Ihr Schreiben. Da der Termin bzw. die Frist zeitnah bevorsteht, möchte ich den Stand meiner Unterlagen kurzfristig bestätigen."
      : tone === "polite"
        ? "vielen Dank für Ihr Schreiben. Gerne bestätige ich den genannten Termin und bereite die angeforderten Unterlagen vor."
        : "vielen Dank für Ihr Schreiben. Ich bestätige den genannten Termin und bereite die angeforderten Unterlagen vor.";

  const deadlineText =
    analysis?.deadline && analysis.deadline !== "Not clearly detected"
      ? `Nach meinem Verständnis ist der relevante Termin bzw. die Frist: ${analysis.deadline}.`
      : "Bitte bestätigen Sie mir, ob aus Ihrer Sicht noch eine konkrete Frist zu beachten ist.";

  const docs =
    analysis?.required_documents && analysis.required_documents.length > 0
      ? `Ich bringe die folgenden Unterlagen mit bzw. reiche sie nach: ${analysis.required_documents.join(", ")}.`
      : "Ich werde die in Ihrem Schreiben genannten Unterlagen vorbereiten.";

  return `${greeting}

${intro}

${deadlineText}

${docs}

Falls weitere Unterlagen erforderlich sind, bitte ich um eine kurze schriftliche Rückmeldung.

Mit freundlichen Grüßen
[Ihr Name]`;
}

export function normalizeAnalysis(value: unknown, fallbackText: string): AnalysisResult {
  const fallback = buildMockAnalysis(fallbackText);

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const record = value as Partial<AnalysisResult>;
  const confidenceLevels = new Set(["low", "medium", "high"]);
  const deadlineTypes = new Set(["exclusionary", "extendable", "none"]);
  const consequenceSeverities = new Set([
    "financial_penalty",
    "status_loss",
    "rejection",
    "delay_only",
    "informational",
  ]);

  const deadline_iso = isValidIsoDate(record.deadline_iso) ? record.deadline_iso! : null;
  const deadline_type: DeadlineType = deadlineTypes.has(record.deadline_type ?? "")
    ? record.deadline_type!
    : fallback.deadline_type;
  const consequence_severity: ConsequenceSeverity = consequenceSeverities.has(
    record.consequence_severity ?? "",
  )
    ? record.consequence_severity!
    : fallback.consequence_severity;

  return {
    category: typeof record.category === "string" ? record.category : fallback.category,
    summary: typeof record.summary === "string" ? record.summary : fallback.summary,
    source_excerpt:
      typeof record.source_excerpt === "string"
        ? record.source_excerpt
        : fallback.source_excerpt,
    required_action:
      typeof record.required_action === "string"
        ? record.required_action
        : fallback.required_action,
    deadline:
      typeof record.deadline === "string" || record.deadline === null
        ? record.deadline
        : fallback.deadline,
    deadline_iso,
    deadline_type,
    consequence_severity,
    risk_level: deriveRiskLevel({ consequenceSeverity: consequence_severity, deadlineType: deadline_type, deadlineIso: deadline_iso }),
    required_documents: Array.isArray(record.required_documents)
      ? record.required_documents.filter((item): item is string => typeof item === "string")
      : fallback.required_documents,
    checklist: Array.isArray(record.checklist)
      ? record.checklist.filter((item): item is string => typeof item === "string")
      : fallback.checklist,
    recommended_next_step:
      typeof record.recommended_next_step === "string"
        ? record.recommended_next_step
        : fallback.recommended_next_step,
    reply_draft_de:
      typeof record.reply_draft_de === "string"
        ? record.reply_draft_de
        : fallback.reply_draft_de,
    confidence: confidenceLevels.has(record.confidence ?? "")
      ? record.confidence!
      : fallback.confidence,
  };
}

function isValidIsoDate(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function createSourceExcerpt(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return "Original document content was provided as a file. Review the generated analysis and checklist for the detected details.";
  }

  return cleaned.length > 420 ? `${cleaned.slice(0, 420).trim()}...` : cleaned;
}
