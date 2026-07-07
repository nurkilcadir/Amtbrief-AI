import type { AnalysisResult } from "@/lib/types";

type ChecklistSummaryInput = {
  analysis: AnalysisResult;
  documentText?: string;
  openLink?: string | null;
  sourceLabel?: string;
};

const authorityLabels: Record<AnalysisResult["authority_type"], string> = {
  auslaenderbehoerde: "Ausländerbehörde",
  buergeramt: "Bürgeramt",
  finanzamt: "Finanzamt",
  insurance: "Insurance",
  jobcenter: "Jobcenter",
  krankenkasse: "Krankenkasse",
  other: "Official letter",
  university_bafog: "University / BAföG office",
  vehicle_registration: "Vehicle registration office",
};

export function buildChecklistChatMessage({
  analysis,
  documentText,
  openLink,
  sourceLabel,
}: ChecklistSummaryInput) {
  const title = buildDocumentTitle({ analysis, documentText, sourceLabel });
  const deadline = analysis.deadline ? `Deadline: ${analysis.deadline}` : "Deadline: not clearly detected";
  const risk = `Risk: ${capitalize(analysis.risk_level)}`;
  const checklist = analysis.checklist.slice(0, 7);
  const paymentLine = analysis.payment_needed
    ? "\nPayment details were detected. Open AmtBrief AI to verify amount, IBAN, and reference against the original letter."
    : "";
  const openLine = openLink
    ? `\nOpen AmtBrief AI to continue: ${openLink}`
    : "\nOpen AmtBrief AI in the Deutschland App to continue.";

  return [
    "AmtBrief AI analyzed your letter:",
    "",
    title,
    "",
    risk,
    deadline,
    "",
    "Your action plan:",
    ...checklist.map((step, index) => `${index + 1}. ${step}`),
    paymentLine,
    openLine,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function buildDocumentTitle({
  analysis,
  documentText,
  sourceLabel,
}: {
  analysis: AnalysisResult;
  documentText?: string;
  sourceLabel?: string;
}) {
  const headerName = extractLetterHeaderName(documentText);
  const authority =
    headerName ||
    authorityLabels[analysis.authority_type] ||
    cleanLabel(sourceLabel) ||
    "Official letter";
  const topic = cleanTopic(analysis.category, authority, authorityLabels[analysis.authority_type]);
  const reference = analysis.reference_number ? ` (${analysis.reference_number})` : "";

  if (!topic) {
    return `${authority}${reference}`;
  }

  return `${authority} - ${topic}${reference}`;
}

function extractLetterHeaderName(text: string | undefined) {
  if (!text) return null;

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(betreff|aktenzeichen|zeichen|datum|sehr geehrte|dear)\b/i.test(line))
    .filter((line) => !/^\d{5}\b/.test(line))
    .filter((line) => !/straße|strasse|platz|weg|allee|zimmer|fachbereich/i.test(line));

  const authorityLine = lines.find((line) =>
    /ausländerbehörde|auslaenderbehoerde|finanzamt|jobcenter|bürgeramt|buergeramt|krankenkasse|bafög|bafoeg|zulassungsstelle|universität|university/i.test(
      line,
    ),
  );

  return cleanLabel(authorityLine ?? lines[0]);
}

function cleanLabel(value: string | undefined | null) {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > 64 ? `${cleaned.slice(0, 61).trim()}...` : cleaned;
}

function cleanTopic(category: string, authority: string, authorityTypeLabel: string) {
  const cleaned = category
    .replace(new RegExp(escapeRegExp(authority), "i"), "")
    .replace(new RegExp(escapeRegExp(authorityTypeLabel), "i"), "")
    .replace(/^[-–—:/\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.toLowerCase() === authority.toLowerCase()) {
    return "";
  }

  return cleaned.length > 70 ? `${cleaned.slice(0, 67).trim()}...` : cleaned;
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
