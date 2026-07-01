import {
  AnalysisResult,
  AuthorityType,
  ConsequenceSeverity,
  DeadlineType,
  DocumentType,
  ReplyTone,
  RequiredActionType,
} from "@/lib/types";
import { deriveRiskLevel } from "@/lib/risk";
import { buildReplyDraft } from "@/lib/reply";
import { buildGermanLetterSummary } from "@/lib/summary";
import { buildTaskChecklist } from "@/lib/tasks";

export function buildMockAnalysis(letterText: string): AnalysisResult {
  const normalized = letterText.toLowerCase();
  const paymentSignals = extractPaymentSignals(letterText);
  const isImmigration =
    normalized.includes("ausländerbehörde") ||
    normalized.includes("aufenthalt") ||
    normalized.includes("reisepass");

  if (paymentSignals) {
    return withGeneratedOutputs({
      category: "Finanzamt - Zwangsgeld / payment request",
      summary:
        "The tax office says a tax declaration was not submitted and threatens or requests a coercive fine. The letter includes bank transfer details. You should verify the amount, IBAN, and reference against the original letter before paying, and submit the missing tax declaration as quickly as possible.",
      source_excerpt: paymentSignals.sourceExcerpt,
      authority_type: "finanzamt",
      document_type: "payment_request",
      required_action_type: "pay",
      required_action:
        "Check the payment details in the original letter, submit the missing tax declaration, and pay or clarify the requested amount before the stated deadline.",
      deadline: paymentSignals.deadline,
      deadline_iso: paymentSignals.deadlineIso,
      deadline_evidence: paymentSignals.deadlineEvidence,
      deadline_type: "exclusionary",
      consequence_severity: "financial_penalty",
      reply_needed: true,
      appointment_needed: false,
      payment_needed: Boolean(paymentSignals.iban),
      payment_amount: paymentSignals.amount,
      payment_iban: paymentSignals.iban,
      proof_needed: true,
      extension_possible: false,
      reference_number: paymentSignals.referenceNumber,
      risk_level: deriveRiskLevel({
        consequenceSeverity: "financial_penalty",
        deadlineType: "exclusionary",
        deadlineIso: paymentSignals.deadlineIso,
      }),
      required_documents: [
        "Complete tax declaration for the requested year",
        "The original Finanzamt letter",
        "Reference number / Verwendungszweck from the letter",
        "Bank transfer confirmation if you pay the amount",
      ],
      checklist: [],
      recommended_next_step:
        "Verify the payment details against the original letter, submit the missing tax declaration, and pay or contact the Finanzamt before the deadline.",
      reply_draft_de: "",
      confidence: "high",
    }, letterText);
  }

  if (!isImmigration) {
    return withGeneratedOutputs({
      category: "German authority letter",
      summary:
        "This appears to be an official letter asking you to react within a defined process. The safest next step is to identify the deadline, collect the requested documents, and answer in writing if anything is unclear.",
      source_excerpt: createSourceExcerpt(letterText),
      authority_type: "other",
      document_type: "other",
      required_action_type: "provide_information",
      required_action:
        "Check the requested documents, confirm the next appointment or deadline, and send a short written reply if you cannot comply exactly as requested.",
      deadline: "Not clearly detected",
      deadline_iso: null,
      deadline_evidence: null,
      deadline_type: "none",
      consequence_severity: "delay_only",
      reply_needed: true,
      appointment_needed: false,
      payment_needed: false,
      payment_amount: null,
      payment_iban: null,
      proof_needed: true,
      extension_possible: true,
      reference_number: null,
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
    }, letterText);
  }

  const immigrationAnalysis: AnalysisResult = {
    category: "Ausländerbehörde - Aufenthaltstitel / missing documents",
    summary:
      "The immigration office is processing an application to extend a residence permit. They need additional documents and have scheduled an appointment. If the documents are incomplete, the decision may be delayed.",
    source_excerpt: createSourceExcerpt(letterText),
    authority_type: "auslaenderbehoerde",
    document_type: "missing_documents",
    required_action_type: "attend_appointment",
    required_action:
      "Attend the appointment or contact the office immediately if the appointment is not possible. Bring the listed documents and keep copies for your records.",
    deadline: "14.08.2026, 09:30",
    deadline_iso: "2026-08-14T09:30:00",
    deadline_evidence:
      "Bitte erscheinen Sie am 14.08.2026 um 09:30 Uhr im BürgerService Zentrum, Zimmer 204, Beispielstraße 12, 12345 Musterstadt.",
    deadline_type: "extendable",
    consequence_severity: "delay_only",
    reply_needed: true,
    appointment_needed: true,
    payment_needed: false,
    payment_amount: null,
    payment_iban: null,
    proof_needed: true,
    extension_possible: true,
    reference_number: "ABH-2026-000471",
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

  return withGeneratedOutputs({
    ...immigrationAnalysis,
    reply_draft_de: buildMockReply(immigrationAnalysis, "polite"),
  }, letterText);
}

export function buildMockReply(
  analysis?: Pick<AnalysisResult, "deadline" | "required_documents"> | AnalysisResult,
  tone: ReplyTone = "neutral",
) {
  if (analysis && "required_action_type" in analysis) {
    return buildReplyDraft(analysis, tone);
  }

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
  const authorityTypes = new Set([
    "auslaenderbehoerde",
    "finanzamt",
    "jobcenter",
    "krankenkasse",
    "buergeramt",
    "university_bafog",
    "insurance",
    "vehicle_registration",
    "other",
  ]);
  const documentTypes = new Set([
    "appointment",
    "missing_documents",
    "payment_request",
    "objection_deadline",
    "hearing",
    "decision_notice",
    "information_only",
    "application_status",
    "other",
  ]);
  const requiredActionTypes = new Set([
    "attend_appointment",
    "submit_documents",
    "pay",
    "reply",
    "file_objection",
    "provide_information",
    "no_action",
    "other",
  ]);
  const deadlineTypes = new Set(["exclusionary", "extendable", "none"]);
  const consequenceSeverities = new Set([
    "financial_penalty",
    "status_loss",
    "rejection",
    "delay_only",
    "informational",
  ]);

  const category = typeof record.category === "string" ? record.category : fallback.category;
  const source_excerpt =
    typeof record.source_excerpt === "string"
      ? record.source_excerpt
      : fallback.source_excerpt;
  const authority_type: AuthorityType = authorityTypes.has(record.authority_type ?? "")
    ? record.authority_type!
    : fallback.authority_type;
  const document_type: DocumentType = documentTypes.has(record.document_type ?? "")
    ? record.document_type!
    : fallback.document_type;
  const required_action_type: RequiredActionType = requiredActionTypes.has(
    record.required_action_type ?? "",
  )
    ? record.required_action_type!
    : fallback.required_action_type;
  const required_action =
    typeof record.required_action === "string"
      ? record.required_action
      : fallback.required_action;
  const deadline =
    typeof record.deadline === "string" || record.deadline === null
      ? record.deadline
      : fallback.deadline;
  const deadline_iso = isValidIsoDate(record.deadline_iso) ? record.deadline_iso! : null;
  const deadline_evidence =
    typeof record.deadline_evidence === "string" && record.deadline_evidence.trim()
      ? record.deadline_evidence
      : null;
  const rawDeadlineType: DeadlineType = deadlineTypes.has(record.deadline_type ?? "")
    ? record.deadline_type!
    : fallback.deadline_type;
  const consequence_severity: ConsequenceSeverity = consequenceSeverities.has(
    record.consequence_severity ?? "",
  )
    ? record.consequence_severity!
    : fallback.consequence_severity;
  const deadline_type = refineDeadlineType({
    consequenceSeverity: consequence_severity,
    fallbackText,
    rawDeadlineType,
    text: `${category} ${required_action} ${deadline ?? ""}`,
  });
  const payment_amount =
    typeof record.payment_amount === "string" && record.payment_amount.trim()
      ? record.payment_amount
      : fallback.payment_amount;
  const payment_iban =
    typeof record.payment_iban === "string" && record.payment_iban.trim()
      ? record.payment_iban
      : fallback.payment_iban;
  const payment_needed =
    (typeof record.payment_needed === "boolean"
      ? record.payment_needed
      : fallback.payment_needed) || Boolean(payment_iban);

  const normalized: AnalysisResult = {
    category,
    summary: fallback.summary,
    source_excerpt,
    authority_type,
    document_type,
    required_action_type,
    required_action,
    deadline,
    deadline_iso,
    deadline_evidence,
    deadline_type,
    consequence_severity,
    reply_needed:
      typeof record.reply_needed === "boolean" ? record.reply_needed : fallback.reply_needed,
    appointment_needed:
      typeof record.appointment_needed === "boolean"
        ? record.appointment_needed
        : fallback.appointment_needed,
    payment_needed,
    payment_amount,
    payment_iban,
    proof_needed:
      typeof record.proof_needed === "boolean" ? record.proof_needed : fallback.proof_needed,
    extension_possible:
      typeof record.extension_possible === "boolean"
        ? record.extension_possible
        : fallback.extension_possible,
    reference_number:
      typeof record.reference_number === "string" || record.reference_number === null
        ? record.reference_number
        : fallback.reference_number,
    risk_level: deriveRiskLevel({
      consequenceSeverity: consequence_severity,
      deadlineType: deadline_type,
      deadlineIso: deadline_iso,
    }),
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

  return withGeneratedOutputs(normalized, fallbackText);
}

function withGeneratedOutputs(
  analysis: AnalysisResult,
  sourceContext = "",
): AnalysisResult {
  const summary = buildGermanLetterSummary({
    ...analysis,
    source_context: sourceContext,
  });
  const checklist = buildTaskChecklist(analysis);
  const replyDraft = buildReplyDraft(analysis, "polite");

  return {
    ...analysis,
    checklist,
    reply_draft_de: replyDraft,
    summary,
  };
}

function refineDeadlineType({
  consequenceSeverity,
  fallbackText,
  rawDeadlineType,
  text,
}: {
  consequenceSeverity: ConsequenceSeverity;
  fallbackText: string;
  rawDeadlineType: DeadlineType;
  text: string;
}): DeadlineType {
  if (consequenceSeverity === "informational") {
    return "none";
  }

  const combined = `${text} ${fallbackText}`.toLowerCase();
  const hasHardDeadlineSignal =
    /\b(widerspruch|einspruch|rechtsbehelf|rechtsbehelfsbelehrung|ausschlussfrist|bestandskr[aä]ftig|zwangsgeld|bußgeld|bussgeld|versp[aä]tungszuschlag|nicht verl[aä]ngert)\b/.test(
      combined,
    );
  const hasAdministrativeSignal =
    /\b(termin|rendezvous|appointment|unterlagen|documents|nachreichen|mitbringen|erscheinen|verz[oö]ger|delay|bearbeitung)\b/.test(
      combined,
    );

  if (
    rawDeadlineType === "exclusionary" &&
    consequenceSeverity === "delay_only" &&
    hasAdministrativeSignal &&
    !hasHardDeadlineSignal
  ) {
    return "extendable";
  }

  return rawDeadlineType;
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

function extractPaymentSignals(text: string) {
  const normalized = text.toLowerCase();
  const iban = text.match(/\bDE\d{2}(?:\s?\d{4}){4}\s?\d{2}\b/i)?.[0] ?? null;
  const hasPaymentLanguage =
    normalized.includes("überweisen") ||
    normalized.includes("verwendungszweck") ||
    normalized.includes("zwangsgeld") ||
    normalized.includes("zahlung") ||
    Boolean(iban);

  if (!hasPaymentLanguage) {
    return null;
  }

  const amount =
    text.match(/(?:betrag|höhe)\s+von\s+([\d.,]+\s*(?:euro|eur|€))/i)?.[1] ??
    text.match(/\b([\d.,]+\s*(?:euro|eur|€))\b/i)?.[1] ??
    null;
  const referenceNumber =
    text.match(/Verwendungszweck\s*:?\s*([A-ZÄÖÜ]{1,6}[-\d]{4,}[-\d]*)/i)?.[1] ??
    text.match(/Aktenzeichen\s*:?\s*([A-ZÄÖÜ]{1,6}[-\d]{4,}[-\d]*)/i)?.[1] ??
    null;
  const deadlineMatch = text.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
  const deadline = deadlineMatch?.[0] ?? "Not clearly detected";
  const deadlineIso = deadlineMatch
    ? `${deadlineMatch[3]}-${deadlineMatch[2]}-${deadlineMatch[1]}`
    : null;
  const deadlineEvidence =
    text
      .split(/\n+/)
      .map((line) => line.trim())
      .find(
        (line) =>
          line.includes(deadline) ||
          line.toLowerCase().includes("nicht verlängert") ||
          line.toLowerCase().includes("zwangsgeld"),
      ) ?? null;

  return {
    amount,
    deadline,
    deadlineEvidence,
    deadlineIso,
    iban,
    referenceNumber,
    sourceExcerpt: deadlineEvidence ?? createSourceExcerpt(text),
  };
}
