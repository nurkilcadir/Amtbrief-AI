import {
  AnalysisResult,
  Confidence,
  ConsequenceSeverity,
  DeadlineType,
} from "@/lib/types";

type SummaryInput = Pick<
  AnalysisResult,
  | "category"
  | "confidence"
  | "consequence_severity"
  | "deadline"
  | "deadline_type"
  | "recommended_next_step"
  | "required_action"
  | "required_documents"
  | "source_excerpt"
> & {
  source_context?: string;
};

export function buildGermanLetterSummary(input: SummaryInput) {
  const authority = inferAuthority(
    `${input.category} ${input.source_excerpt} ${input.source_context ?? ""}`,
  );
  const intro = buildIntro(input.category, authority);
  const action = buildActionSentence(input.required_action, input.required_documents);
  const deadline = buildDeadlineSentence(input.deadline, input.deadline_type);
  const consequence = buildConsequenceSentence(input.consequence_severity);
  const nextStep = buildNextStepSentence(
    input.recommended_next_step,
    input.consequence_severity,
  );
  const confidence = buildConfidenceSentence(input.confidence);

  return compactSentences([
    `${intro} ${action}`,
    `${deadline} ${consequence}`,
    `${nextStep}${confidence ? ` ${confidence}` : ""}`,
  ]);
}

function buildIntro(category: string, authority: string) {
  const topic = toReadableTopic(cleanSentence(category)) || "an official German letter";

  if (authority === "German authority") {
    return `This letter is about ${lowercaseFirst(topic)}.`;
  }

  return `This letter is from the ${authority} and is about ${lowercaseFirst(topic)}.`;
}

function buildActionSentence(requiredAction: string, requiredDocuments: string[]) {
  const action = cleanSentence(requiredAction);
  const documents = requiredDocuments.filter((document) => document.trim()).slice(0, 3);
  const actionPhrase = toActionPhrase(action);

  if (requiredActionMeansNoAction(action)) {
    return "It does not ask for a mandatory response.";
  }

  if ((!action || shouldUseGenericAction(action)) && documents.length === 0) {
    return "It asks you to check the letter and confirm whether a response is required.";
  }

  if (!shouldUseGenericAction(action) && documents.length === 0) {
    return `It asks you to ${actionPhrase}.`;
  }

  if (!shouldUseGenericAction(action)) {
    return `It asks you to ${actionPhrase}, with documents such as ${formatList(documents)}.`;
  }

  return `It asks you to complete the requested step and prepare documents such as ${formatList(documents)}.`;
}

function buildDeadlineSentence(deadline: string | null, deadlineType: DeadlineType) {
  if (!isUsefulDeadline(deadline)) {
    if (deadlineType === "exclusionary") {
      return "A hard legal deadline may apply, but no exact date was detected.";
    }

    if (deadlineType === "extendable") {
      return "A deadline or appointment may apply, but no exact date was detected.";
    }

    return "No exact deadline was detected.";
  }

  if (deadlineType === "exclusionary") {
    return `The important deadline is ${deadline}, and it appears hard to reverse if missed.`;
  }

  if (deadlineType === "extendable") {
    return `The important date is ${deadline}; it appears to be an administrative deadline or appointment.`;
  }

  return `The letter mentions ${deadline}, but it does not appear to create a fixed legal deadline.`;
}

function buildConsequenceSentence(consequenceSeverity: ConsequenceSeverity) {
  switch (consequenceSeverity) {
    case "financial_penalty":
      return "If you do not act, the likely consequence is a fine, fee, or enforcement measure.";
    case "status_loss":
      return "If you do not act, the likely consequence is a problem with legal status, benefits, insurance, or eligibility.";
    case "rejection":
      return "If you do not act, the likely consequence is that an application or request may be rejected.";
    case "delay_only":
      return "If you do not act, the likely consequence is a delay or an incomplete process.";
    case "informational":
      return "No mandatory reaction or penalty was detected.";
  }
}

function buildNextStepSentence(
  recommendedNextStep: string,
  consequenceSeverity: ConsequenceSeverity,
) {
  const nextStep = cleanSentence(recommendedNextStep);

  if (!nextStep) {
    return "Your first step should be to check the dates, reference number, and requested documents.";
  }

  if (shouldUseGenericAction(nextStep)) {
    if (consequenceSeverity === "informational") {
      return "Your first step should be to note the information and keep the letter if you may need it later.";
    }

    if (consequenceSeverity === "financial_penalty") {
      return "Your first step should be to complete the requested submission or payment before the deadline.";
    }

    if (consequenceSeverity === "status_loss") {
      return "Your first step should be to protect your status, benefits, or eligibility by responding before the deadline.";
    }

    return "Your first step should be to check the deadline, prepare the requested documents, and keep proof of any reply.";
  }

  return `Your first step should be to ${toActionPhrase(nextStep)}.`;
}

function buildConfidenceSentence(confidence: Confidence) {
  if (confidence !== "low") return "";

  return "Because the analysis confidence is low, verify the deadline and requested documents against the original letter before acting.";
}

function inferAuthority(rawText: string) {
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
  return match?.[1] ?? "German authority";
}

function cleanSentence(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.?!]+$/, "");
}

function toReadableTopic(value: string) {
  return value
    .split(/(\s+|[-/])/)
    .map((part) => {
      if (!/[A-Za-zÄÖÜäöüß]/.test(part)) return part;
      if (part === part.toUpperCase() && part.length <= 6) return part;
      return part.toLowerCase();
    })
    .join("");
}

function compactSentences(sentences: string[]) {
  return sentences
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
}

function formatList(items: string[]) {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function lowercaseFirst(value: string) {
  if (!value) return value;
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function toActionPhrase(value: string) {
  return lowercaseFirst(value)
    .replace(/^you (must|should|need to|have to)\s+/i, "")
    .replace(/^please\s+/i, "")
    .replace(/^to\s+/i, "");
}

function shouldUseGenericAction(value: string) {
  return /\b(sie|unterlagen|frist|termin|nachweis|reichen|bringen|erscheinen|bestätigen|vorbereiten|zur kenntnis)\b/i.test(
    value,
  );
}

function requiredActionMeansNoAction(value: string) {
  return /\b(no action|no response|not required|keine reaktion|nicht erforderlich|zur kenntnisnahme)\b/i.test(
    value,
  );
}

function isUsefulDeadline(deadline: string | null) {
  return Boolean(
    deadline &&
      !/\b(not clearly|no exact|no deadline|keine frist|keine konkrete frist|nicht angegeben)\b/i.test(
        deadline,
      ),
  );
}
