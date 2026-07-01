import { AnalysisResult, ReplyTone } from "@/lib/types";

export type ReplyIntent =
  | "appointment_documents"
  | "appointment_confirmation"
  | "document_submission"
  | "payment_clarification"
  | "objection_review"
  | "information_reply"
  | "acknowledgement"
  | "general_reply";

export type ReplyPlan = {
  intent: ReplyIntent;
  subject: string;
  referenceLine: string;
  deadlineLine: string;
  paragraphs: string[];
  closingSentence: string;
  safetyInstruction: string;
};

const bannedReplyPhrases = [
  "ich erkenne die forderung an",
  "ich verzichte auf",
  "ich bin schuldig",
  "ich hafte",
  "rechtsverbindlich garantiere ich",
];

export function buildReplyDraft(analysis: AnalysisResult, tone: ReplyTone = "polite") {
  const plan = buildReplyPlan(analysis, tone);
  const intro = getToneIntro(tone, plan.intent);
  const lines = [
    `Betreff: ${plan.subject}`,
    plan.referenceLine,
    "",
    "Sehr geehrte Damen und Herren,",
    "",
    intro,
    "",
    ...plan.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    plan.closingSentence,
    "",
    "Mit freundlichen Grüßen",
    "[Ihr Name]",
  ];

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildReplyPlan(
  analysis: AnalysisResult,
  tone: ReplyTone = "polite",
): ReplyPlan {
  const intent = getReplyIntent(analysis);
  const deadlineLine = getDeadlineLine(analysis);
  const documents = getDocumentsText(analysis.required_documents);
  const referenceLine = analysis.reference_number
    ? `Aktenzeichen / Referenz: ${analysis.reference_number}`
    : "Aktenzeichen / Referenz: [falls vorhanden eintragen]";

  switch (intent) {
    case "appointment_documents":
      return {
        intent,
        subject: "Rückmeldung zu Ihrem Termin und den angeforderten Unterlagen",
        referenceLine,
        deadlineLine,
        paragraphs: compactParagraphs([
          deadlineLine,
          `Ich bereite die angeforderten Unterlagen vor. Nach meinem Verständnis betrifft dies: ${documents}.`,
          analysis.extension_possible
            ? "Falls einzelne Unterlagen bis zum Termin nicht vollständig vorliegen, bitte ich um kurze Mitteilung, ob eine Nachreichung möglich ist oder ein neuer Termin vereinbart werden sollte."
            : null,
          "Bitte bestätigen Sie mir kurz den Eingang dieser Rückmeldung und teilen Sie mir mit, falls noch etwas fehlt.",
        ]),
        closingSentence: getClosingSentence(tone, true),
        safetyInstruction:
          "Confirm appointment and document preparation only. Do not invent personal facts, legal arguments, or attached documents.",
      };

    case "appointment_confirmation":
      return {
        intent,
        subject: "Bestätigung des Termins",
        referenceLine,
        deadlineLine,
        paragraphs: compactParagraphs([
          deadlineLine,
          "Ich bestätige den genannten Termin. Bitte teilen Sie mir mit, falls ich zusätzlich bestimmte Unterlagen oder Nachweise mitbringen soll.",
          analysis.extension_possible
            ? "Sollte der Termin aus wichtigem Grund nicht möglich sein, bitte ich um Mitteilung, wie ein Ersatztermin vereinbart werden kann."
            : null,
        ]),
        closingSentence: getClosingSentence(tone, true),
        safetyInstruction:
          "Confirm the appointment. Do not add attachments, payments, or legal claims unless they are in the plan.",
      };

    case "document_submission":
      return {
        intent,
        subject: "Nachreichung angeforderter Unterlagen",
        referenceLine,
        deadlineLine,
        paragraphs: compactParagraphs([
          deadlineLine,
          `Ich bereite die angeforderten Unterlagen zur Nachreichung vor. Nach meinem Verständnis werden folgende Unterlagen benötigt: ${documents}.`,
          "Bitte bestätigen Sie mir den Eingang der Unterlagen und informieren Sie mich schriftlich, falls weitere Nachweise erforderlich sind.",
          analysis.extension_possible
            ? "Falls eine vollständige Einreichung bis zur genannten Frist nicht möglich ist, bitte ich vorsorglich um Mitteilung, ob eine kurze Fristverlängerung möglich ist."
            : null,
        ]),
        closingSentence: getClosingSentence(tone, true),
        safetyInstruction:
          "Focus on missing documents and receipt confirmation. Do not claim that documents are attached unless the user adds them.",
      };

    case "payment_clarification":
      return {
        intent,
        subject: "Rückfrage zu Ihrer Zahlungsaufforderung",
        referenceLine,
        deadlineLine,
        paragraphs: compactParagraphs([
          deadlineLine,
          "Ich habe Ihre Zahlungsaufforderung erhalten. Bitte bestätigen Sie mir, dass der im Schreiben genannte Betrag, der Verwendungszweck und die Bankverbindung für die Zahlung zu verwenden sind.",
          analysis.extension_possible
            ? "Falls eine Zahlung innerhalb der genannten Frist nicht vollständig möglich ist, bitte ich um Mitteilung, ob eine Stundung oder Ratenzahlung beantragt werden kann."
            : null,
          "Bitte bestätigen Sie den Eingang dieser Rückfrage schriftlich.",
        ]),
        closingSentence: getClosingSentence(tone, true),
        safetyInstruction:
          "Clarify payment details only. Do not admit debt, liability, guilt, or make promises to pay beyond the stated document.",
      };

    case "objection_review":
      return {
        intent,
        subject: "Fristwahrende Rückmeldung zu Ihrem Bescheid",
        referenceLine,
        deadlineLine,
        paragraphs: compactParagraphs([
          deadlineLine,
          "[Bitte vor Versand prüfen: Verwenden Sie den folgenden Satz nur, wenn Sie tatsächlich Widerspruch einlegen möchten.] Hiermit lege ich fristwahrend Widerspruch gegen den Bescheid vom [Datum des Bescheids] ein.",
          "Eine Begründung reiche ich, sofern erforderlich, nach. Bitte bestätigen Sie mir den Eingang dieses Schreibens schriftlich.",
        ]),
        closingSentence: getClosingSentence(tone, true),
        safetyInstruction:
          "This may preserve an objection deadline. Keep the review placeholder. Do not invent legal reasons or legal advice.",
      };

    case "information_reply":
      return {
        intent,
        subject: "Rückmeldung zu Ihrem Schreiben",
        referenceLine,
        deadlineLine,
        paragraphs: compactParagraphs([
          deadlineLine,
          "Ich nehme Bezug auf Ihr Schreiben und werde die angeforderten Informationen bereitstellen.",
          "Bitte bestätigen Sie mir kurz, ob aus Ihrer Sicht noch weitere Angaben oder Nachweise erforderlich sind.",
        ]),
        closingSentence: getClosingSentence(tone, true),
        safetyInstruction:
          "Provide a simple response and ask for confirmation. Do not add unknown personal information.",
      };

    case "acknowledgement":
      return {
        intent,
        subject: "Bestätigung des Erhalts Ihres Schreibens",
        referenceLine,
        deadlineLine,
        paragraphs: compactParagraphs([
          "Vielen Dank für die Information. Ich nehme Ihr Schreiben zur Kenntnis.",
          "Bitte teilen Sie mir mit, falls von meiner Seite doch noch eine Handlung erforderlich ist.",
        ]),
        closingSentence: getClosingSentence(tone, false),
        safetyInstruction:
          "Acknowledge the information only. Do not create obligations or actions that were not requested.",
      };

    default:
      return {
        intent,
        subject: "Rückmeldung zu Ihrem Schreiben",
        referenceLine,
        deadlineLine,
        paragraphs: compactParagraphs([
          deadlineLine,
          "Ich nehme Bezug auf Ihr Schreiben und möchte sicherstellen, dass ich die nächsten Schritte korrekt erledige.",
          analysis.required_action
            ? `Nach meinem Verständnis soll ich Folgendes tun: ${analysis.required_action}`
            : null,
          "Bitte bestätigen Sie mir kurz, ob diese Einschätzung korrekt ist und ob weitere Unterlagen oder Angaben erforderlich sind.",
        ]),
        closingSentence: getClosingSentence(tone, true),
        safetyInstruction:
          "Ask for confirmation of next steps. Do not invent deadlines, payments, attachments, or legal arguments.",
      };
  }
}

export function validateReplyDraft(candidate: string, fallback: string) {
  const draft = candidate.trim();
  const normalized = draft.toLowerCase();

  if (draft.length < 180 || draft.length > 3200) {
    return fallback;
  }

  if (
    !normalized.includes("sehr geehrte") ||
    !normalized.includes("mit freundlichen grüßen") ||
    !draft.includes("[Ihr Name]")
  ) {
    return fallback;
  }

  if (bannedReplyPhrases.some((phrase) => normalized.includes(phrase))) {
    return fallback;
  }

  return draft;
}

function getReplyIntent(analysis: AnalysisResult): ReplyIntent {
  if (
    analysis.required_action_type === "file_objection" ||
    analysis.document_type === "objection_deadline"
  ) {
    return "objection_review";
  }

  if (
    analysis.required_action_type === "pay" ||
    analysis.payment_needed ||
    analysis.document_type === "payment_request"
  ) {
    return "payment_clarification";
  }

  if (
    analysis.appointment_needed ||
    analysis.required_action_type === "attend_appointment" ||
    analysis.document_type === "appointment"
  ) {
    return hasRequestedDocuments(analysis)
      ? "appointment_documents"
      : "appointment_confirmation";
  }

  if (
    analysis.required_action_type === "submit_documents" ||
    analysis.document_type === "missing_documents" ||
    hasRequestedDocuments(analysis)
  ) {
    return "document_submission";
  }

  if (
    analysis.required_action_type === "provide_information" ||
    analysis.required_action_type === "reply" ||
    analysis.reply_needed
  ) {
    return "information_reply";
  }

  if (
    analysis.required_action_type === "no_action" ||
    analysis.document_type === "information_only" ||
    analysis.consequence_severity === "informational"
  ) {
    return "acknowledgement";
  }

  return "general_reply";
}

function getToneIntro(tone: ReplyTone, intent: ReplyIntent) {
  if (tone === "urgent") {
    return "vielen Dank für Ihr Schreiben. Da der Termin bzw. die Frist zeitnah relevant sein kann, bitte ich um eine kurzfristige schriftliche Rückmeldung.";
  }

  if (intent === "acknowledgement") {
    return tone === "polite"
      ? "vielen Dank für Ihr Schreiben."
      : "ich bestätige den Erhalt Ihres Schreibens.";
  }

  return tone === "polite"
    ? "vielen Dank für Ihr Schreiben. Gerne nehme ich hierzu wie folgt Stellung."
    : "ich nehme Bezug auf Ihr Schreiben und melde mich hierzu wie folgt zurück.";
}

function getDeadlineLine(analysis: AnalysisResult) {
  if (!hasUsefulDeadline(analysis.deadline)) {
    return "In Ihrem Schreiben konnte ich keine eindeutige Frist erkennen. Bitte teilen Sie mir mit, falls eine konkrete Frist zu beachten ist.";
  }

  const label = analysis.deadline;

  if (analysis.deadline_type === "exclusionary") {
    return `Nach meinem Verständnis ist die genannte Frist ${label}. Ich möchte sicherstellen, dass meine Rückmeldung rechtzeitig eingeht.`;
  }

  if (analysis.appointment_needed || analysis.required_action_type === "attend_appointment") {
    return `Nach meinem Verständnis ist der relevante Termin ${label}.`;
  }

  return `Nach meinem Verständnis ist die relevante Frist ${label}.`;
}

function getDocumentsText(documents: string[]) {
  const cleaned = documents.map((item) => item.trim()).filter(Boolean);

  if (cleaned.length === 0) {
    return "die in Ihrem Schreiben genannten Unterlagen";
  }

  return cleaned.join(", ");
}

function getClosingSentence(tone: ReplyTone, asksForReply: boolean) {
  if (tone === "urgent") {
    return asksForReply
      ? "Für eine kurzfristige schriftliche Rückmeldung danke ich Ihnen."
      : "Vielen Dank für Ihre Mitteilung.";
  }

  if (tone === "polite") {
    return asksForReply
      ? "Vielen Dank im Voraus für Ihre schriftliche Rückmeldung."
      : "Vielen Dank.";
  }

  return asksForReply
    ? "Bitte geben Sie mir hierzu eine kurze schriftliche Rückmeldung."
    : "Ich bestätige den Erhalt.";
}

function hasRequestedDocuments(analysis: AnalysisResult) {
  return analysis.required_documents.some((item) => item.trim().length > 0);
}

function hasUsefulDeadline(deadline: string | null) {
  return Boolean(
    deadline &&
      !/\b(not clearly|no exact|no deadline|keine frist|keine konkrete frist|nicht angegeben)\b/i.test(
        deadline,
      ),
  );
}

function compactParagraphs(paragraphs: Array<string | null>) {
  return paragraphs.filter((paragraph): paragraph is string => Boolean(paragraph?.trim()));
}
