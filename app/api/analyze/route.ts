import { NextResponse } from "next/server";
import { buildMockAnalysis, normalizeAnalysis } from "@/lib/mock-ai";
import { AnalysisInputType } from "@/lib/types";

export const runtime = "nodejs";

const maxPdfSize = 15 * 1024 * 1024;
const maxImageSize = 8 * 1024 * 1024;

const acceptedPdfTypes = new Set(["application/pdf"]);
const acceptedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

type AnalyzeRequest = {
  text: string;
  file: File | null;
  inputType: AnalysisInputType;
  sourceLabel: string;
};

export async function POST(request: Request) {
  const input = await readAnalyzeRequest(request);
  const validationError = validateAnalyzeRequest(input);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const prepared = await prepareAnalyzeInput(input);

  if ("error" in prepared) {
    return NextResponse.json({ error: prepared.error }, { status: prepared.status });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      buildMockAnalysis(prepared.input.text || createFileFallbackText(prepared.input)),
    );
  }

  try {
    const parsed = await analyzeWithOpenRouter(prepared.input);
    const fallbackText = prepared.input.text || createFileFallbackText(prepared.input);
    const normalized = normalizeAnalysis(
      parsed,
      fallbackText,
    );
    const enriched = normalizeAnalysis(
      enrichAnalysisFromRecognizedFields(normalized),
      buildAnalysisContext(normalized, fallbackText),
    );
    return NextResponse.json(groundEvidenceFields(enriched, prepared.input.text));
  } catch (error) {
    console.error("AmtBrief analysis failed", error);
    return NextResponse.json(
      {
        error:
          "The live AI service could not analyze this document. Please try a clearer file, upload a different format, or paste the letter text.",
      },
      { status: 502 },
    );
  }
}

async function readAnalyzeRequest(request: Request): Promise<AnalyzeRequest> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const fileValue = formData.get("file");
    const text = String(formData.get("text") ?? "").trim();
    const inputType = parseInputType(formData.get("inputType"));
    const sourceLabel = String(formData.get("sourceLabel") ?? "").trim();

    return {
      text,
      file: fileValue instanceof File ? fileValue : null,
      inputType,
      sourceLabel: sourceLabel || getDefaultSourceLabel(inputType, fileValue),
    };
  }

  const body = (await request.json().catch(() => ({}))) as {
    inputType?: unknown;
    letterText?: string;
    sourceLabel?: string;
    text?: string;
  };
  const text = (body.text ?? body.letterText ?? "").trim();
  const inputType = parseInputType(body.inputType ?? "text");

  return {
    text,
    file: null,
    inputType,
    sourceLabel: body.sourceLabel?.trim() || "Pasted letter",
  };
}

function validateAnalyzeRequest(input: AnalyzeRequest) {
  if (input.file) {
    if (input.inputType === "text" || input.inputType === "example") {
      return "File uploads must use inputType pdf, image, or camera.";
    }

    if (input.inputType === "pdf") {
      if (!acceptedPdfTypes.has(input.file.type)) {
        return "Only PDF files are supported for PDF upload.";
      }
      if (input.file.size > maxPdfSize) {
        return "PDF files must be 15MB or smaller.";
      }
      return null;
    }

    if (!acceptedImageTypes.has(input.file.type)) {
      return "Images must be PNG, JPG, JPEG, or WEBP.";
    }

    if (input.file.size > maxImageSize) {
      return "Image files must be 8MB or smaller.";
    }

    return null;
  }

  if (input.text.length < 80) {
    return "Paste at least 80 characters from the letter.";
  }

  return null;
}

async function prepareAnalyzeInput(
  input: AnalyzeRequest,
): Promise<{ input: AnalyzeRequest } | { error: string; status: number }> {
  if (!input.file || input.inputType !== "pdf") {
    return { input };
  }

  try {
    const text = await extractTextFromPdf(input.file);

    if (text.length < 80) {
      return {
        status: 400,
        error:
          "This PDF does not contain enough readable text. If it is a scanned letter, upload it as an image/photo or paste the text.",
      };
    }

    return {
      input: {
        ...input,
        text,
        file: null,
      },
    };
  } catch (error) {
    console.error("PDF text extraction failed", error);
    return {
      status: 400,
      error:
        "We could not read text from this PDF. If it is password protected or scanned, upload a clear image/photo or paste the letter text.",
    };
  }
}

async function analyzeWithOpenRouter(input: AnalyzeRequest) {
  const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-mini";
  const maxTokens = getOpenRouterMaxTokens();
  const content = await buildOpenRouterContent(input);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL ?? "http://localhost:4173",
      "X-Title": "AmtBrief AI",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "amtbrief_analysis",
          strict: true,
          schema: analysisJsonSchema,
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You are AmtBrief AI, a German bureaucracy copilot. Analyze official German letters and return only valid JSON. Be practical, clear, and non-legal-advice. Checklist must contain 5 to 7 concrete steps. Include source_excerpt as a short recognized excerpt or concise source summary from the original document, useful for identifying the uploaded letter later. The source_excerpt must be copied verbatim from the original document text, not paraphrased. For deadline_iso, return a precise ISO 8601 date (and time, if known) only when the letter states an exact, unambiguous date; otherwise return null and explain in deadline instead. For deadline_evidence, quote the exact sentence (verbatim, original wording) from the letter that states the deadline, so the user can verify it themselves; return null if no deadline was found.\n\n" +
            "Return category, summary, required_action, deadline, required_documents, checklist, recommended_next_step, confidence, consequence_severity, and deadline_type in clear English for the app UI. Only source_excerpt and deadline_evidence should preserve original German wording, and only reply_draft_de should be written in German.\n\n" +
            "Also classify task planning signals instead of inventing final tasks: authority_type, document_type, required_action_type, reply_needed, appointment_needed, payment_needed, proof_needed, extension_possible, and reference_number. These signals must be based only on the letter. The app will use deterministic German bureaucracy rules to create the final checklist.\n\n" +
            "For payment_amount, quote the exact amount as written in the letter (e.g. '500 Euro' or '47,30 EUR'); return null if no amount is stated. For payment_iban, quote the exact IBAN as written in the letter, character for character - this is shown to the user as a real bank transfer target, so accuracy is critical; return null if no IBAN is present, never guess or construct one. Both must be copied verbatim from the original document text.\n\n" +
            "Classify consequence_severity by what actually happens if the recipient does nothing, based on how German authorities escalate in real life: 'financial_penalty' if a Bußgeld, Zwangsgeld, or Verspätungszuschlag is threatened; 'status_loss' if a legal status, benefit, or permit would lapse or be revoked (e.g. residence permit, Leistungseinstellung); 'rejection' if an application would simply be denied without further escalation; 'delay_only' if the only consequence is the process taking longer (e.g. 'Verzögerung', missing documents postponing a decision); 'informational' if the letter is a routine notice with no required reaction.\n\n" +
            "Classify deadline_type by whether the deadline can realistically be negotiated: 'exclusionary' if missing it causes an irreversible loss of rights typical of a gesetzliche Ausschlussfrist (e.g. Widerspruchsfrist, Einspruchsfrist - usually phrased as a hard legal deadline, often around 1 month, tied to an appeal or legal remedy); 'extendable' if it is a routine administrative appointment or request where asking for a new date or more time is normal practice; 'none' if there is no concrete deadline at all.\n\n" +
            "Do not invent your own risk_level from intuition - it will be computed from consequence_severity and deadline_type, so focus on classifying those two fields accurately. Do not include unnecessary sensitive details.",
        },
        {
          role: "user",
          content,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(await getOpenRouterErrorMessage(response));
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const rawContent = data.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new Error("OpenRouter returned an empty analysis response");
  }

  try {
    return JSON.parse(rawContent);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `OpenRouter returned invalid analysis JSON: ${error.message}`
        : "OpenRouter returned invalid analysis JSON",
    );
  }
}

/**
 * Confirms the model's source_excerpt and deadline_evidence are actually
 * grounded in the original text (rather than hallucinated). Only applicable
 * when we have extracted text to compare against (text input or PDF) -
 * vision-only flows (image, camera) have no original text and are skipped.
 *
 * source_excerpt failing grounding downgrades overall confidence, since it
 * is the headline "this is the letter we recognized" claim. deadline_evidence
 * failing grounding is narrower in scope, so it is simply nulled out instead
 * of dragging down confidence in the entire analysis - the UI just hides the
 * "Why?" citation for the deadline when we can't back it up.
 */
function groundEvidenceFields(
  analysis: ReturnType<typeof normalizeAnalysis>,
  originalText: string,
): ReturnType<typeof normalizeAnalysis> {
  if (!originalText) {
    return analysis;
  }

  const normalizedOriginal = normalizeForComparison(originalText);
  let next = analysis;

  if (next.source_excerpt && !isGrounded(next.source_excerpt, normalizedOriginal)) {
    console.warn("AmtBrief: source_excerpt failed grounding check, downgrading confidence");
    next = { ...next, confidence: "low" };
  }

  if (next.deadline_evidence && !isGrounded(next.deadline_evidence, normalizedOriginal)) {
    console.warn("AmtBrief: deadline_evidence failed grounding check, dropping it");
    next = { ...next, deadline_evidence: null };
  }

  if (next.payment_amount && !isGrounded(next.payment_amount, normalizedOriginal)) {
    console.warn("AmtBrief: payment_amount failed grounding check, dropping it");
    next = { ...next, payment_amount: null };
  }

  if (next.payment_iban && !isGrounded(next.payment_iban, normalizedOriginal, { exact: true })) {
    console.warn("AmtBrief: payment_iban failed grounding check, dropping it");
    next = { ...next, payment_iban: null };
  }

  return next;
}

function enrichAnalysisFromRecognizedFields(
  analysis: ReturnType<typeof normalizeAnalysis>,
): ReturnType<typeof normalizeAnalysis> {
  const recognizedText = buildAnalysisContext(analysis, "");
  const normalized = recognizedText.toLowerCase();
  const paymentSignals = extractRecognizedPaymentSignals(recognizedText);
  const hasFinanzamtSignal =
    /\bfinanzamt\b/i.test(recognizedText) ||
    /\beinkommensteuer\b/i.test(recognizedText);
  const hasPaymentSignal =
    paymentSignals.hasPaymentLanguage ||
    Boolean(paymentSignals.amount) ||
    Boolean(paymentSignals.iban) ||
    Boolean(paymentSignals.referenceNumber);

  if (!hasFinanzamtSignal && !hasPaymentSignal) {
    return analysis;
  }

  const hasPenaltySignal =
    /\b(zwangsgeld|bußgeld|bussgeld|versp[aä]tungszuschlag|mahnung|androhung)\b/i.test(
      recognizedText,
    );

  return {
    ...analysis,
    authority_type: hasFinanzamtSignal ? "finanzamt" : analysis.authority_type,
    document_type: hasPaymentSignal ? "payment_request" : analysis.document_type,
    required_action_type:
      hasPaymentSignal && analysis.required_action_type !== "file_objection"
        ? "pay"
        : analysis.required_action_type,
    consequence_severity: hasPenaltySignal
      ? "financial_penalty"
      : analysis.consequence_severity,
    deadline_type:
      hasPenaltySignal || normalized.includes("nicht verlängert")
        ? "exclusionary"
        : analysis.deadline_type,
    payment_needed: hasPaymentSignal || analysis.payment_needed,
    payment_amount: analysis.payment_amount ?? paymentSignals.amount,
    payment_iban: analysis.payment_iban ?? paymentSignals.iban,
    proof_needed: hasPaymentSignal || analysis.proof_needed,
    reference_number: analysis.reference_number ?? paymentSignals.referenceNumber,
  };
}

function buildAnalysisContext(
  analysis: ReturnType<typeof normalizeAnalysis>,
  fallbackText: string,
) {
  return [
    fallbackText,
    analysis.category,
    analysis.summary,
    analysis.source_excerpt,
    analysis.required_action,
    analysis.deadline ?? "",
    analysis.deadline_evidence ?? "",
    analysis.payment_amount ?? "",
    analysis.payment_iban ?? "",
    analysis.reference_number ?? "",
    analysis.recommended_next_step,
    analysis.required_documents.join("\n"),
    analysis.checklist.join("\n"),
    analysis.reply_draft_de,
  ]
    .filter(Boolean)
    .join("\n");
}

function extractRecognizedPaymentSignals(text: string) {
  const iban = text.match(/\bDE\d{2}(?:\s?\d{4}){4}\s?\d{2}\b/i)?.[0] ?? null;
  const amount =
    text.match(/(?:betrag|höhe)\s+von\s+([\d.,]+\s*(?:euro|eur|€))/i)?.[1] ??
    text.match(/\b([\d.,]+\s*(?:euro|eur|€))\b/i)?.[1] ??
    null;
  const referenceNumber =
    text.match(/Verwendungszweck\s*:?\s*([A-ZÄÖÜ]{1,6}[-\d]{4,}[-\d]*)/i)?.[1] ??
    text.match(/Aktenzeichen\s*:?\s*([A-ZÄÖÜ]{1,6}[-\d]{4,}[-\d]*)/i)?.[1] ??
    text.match(/\b(FA-\d{4,}-\d{3,})\b/i)?.[1] ??
    null;
  const normalized = text.toLowerCase();
  const hasPaymentLanguage =
    normalized.includes("überweisen") ||
    normalized.includes("ueberweisen") ||
    normalized.includes("verwendungszweck") ||
    normalized.includes("zwangsgeld") ||
    normalized.includes("zahlung") ||
    normalized.includes("betrag") ||
    normalized.includes("konto") ||
    Boolean(iban);

  return {
    amount,
    hasPaymentLanguage,
    iban,
    referenceNumber,
  };
}

function isGrounded(claim: string, normalizedOriginal: string, options?: { exact?: boolean }) {
  const normalizedClaim = normalizeForComparison(claim.replace(/\.\.\.$/, ""));

  if (!normalizedClaim) {
    return true;
  }

  if (normalizedOriginal.includes(normalizedClaim)) {
    return true;
  }

  // Exact mode (IBANs, account numbers): a near-miss is as dangerous as a
  // total fabrication - one wrong digit sends money to the wrong account.
  // Fuzzy word-overlap matching is only safe for prose claims. Still allow
  // whitespace-grouping differences (IBANs are conventionally chunked in
  // groups of 4, but extracted PDF/OCR text may not preserve that spacing).
  if (options?.exact) {
    return normalizedOriginal
      .replace(/\s+/g, "")
      .includes(normalizedClaim.replace(/\s+/g, ""));
  }

  return wordOverlapRatio(normalizedClaim, normalizedOriginal) >= 0.6;
}

function normalizeForComparison(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordOverlapRatio(excerpt: string, original: string) {
  const originalWords = new Set(original.split(" ").filter((word) => word.length > 3));
  const excerptWords = excerpt.split(" ").filter((word) => word.length > 3);

  if (excerptWords.length === 0) {
    return 1;
  }

  const matched = excerptWords.filter((word) => originalWords.has(word)).length;
  return matched / excerptWords.length;
}

function getOpenRouterMaxTokens() {
  const value = Number(process.env.OPENROUTER_MAX_TOKENS);
  return Number.isFinite(value) && value > 0 ? value : 2200;
}

async function getOpenRouterErrorMessage(response: Response) {
  const fallback = `OpenRouter analysis request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as { error?: { message?: string }; message?: string };
    return body.error?.message || body.message || fallback;
  } catch {
    return fallback;
  }
}

async function buildOpenRouterContent(input: AnalyzeRequest) {
  const instruction = [
    "Analyze this German official letter.",
    "Return category, summary, required action, deadline, risk level, required documents, suggested checklist, recommended next step, and confidence in clear English.",
    "Classify task planning signals: authority_type, document_type, required_action_type, reply_needed, appointment_needed, payment_needed, proof_needed, extension_possible, and reference_number.",
    "Return source_excerpt in original German wording and reply_draft_de as a formal German reply.",
    "source_excerpt should be one short recognized excerpt or concise source summary from the original document so the user can identify this scan later.",
    `Input source: ${input.inputType}.`,
    input.inputType === "pdf"
      ? "The PDF text was extracted locally before analysis."
      : "",
    input.inputType === "image" || input.inputType === "camera"
      ? "This is a photographed/scanned letter. First read the visible text carefully like OCR. Pay special attention to the top authority header, Aktenzeichen/reference number, Betreff, deadlines, amount/Betrag, Konto/IBAN, and Verwendungszweck. If you see Finanzamt, Zwangsgeld, überweisen, Betrag, Konto, IBAN, or Verwendungszweck, classify it as a Finanzamt payment request and copy payment_amount, payment_iban, and reference_number exactly as visible. Do not ignore payment details just because the photo is imperfect."
      : "",
  ].join("\n");

  if (!input.file) {
    return [
      {
        type: "text",
        text: `${instruction}\n\nLetter text:\n${input.text}`,
      },
    ];
  }

  const dataUrl = await fileToDataUrl(input.file);

  if (input.inputType === "pdf") {
    return [
      { type: "text", text: instruction },
      {
        type: "file",
        file: {
          filename: input.file.name || "official-letter.pdf",
          file_data: dataUrl,
        },
      },
    ];
  }

  return [
    { type: "text", text: instruction },
    {
      type: "image_url",
      image_url: {
        url: dataUrl,
      },
    },
  ];
}

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

async function extractTextFromPdf(file: File) {
  installPdfJsNodePolyfills();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({
    data,
    disableWorker: true,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: true,
    useWorkerFetch: false,
  } as unknown as Parameters<typeof pdfjs.getDocument>[0]);
  const pdfDocument = await loadingTask.promise;
  const pageTexts: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item) => {
          const textItem = item as Partial<{ hasEOL: boolean; str: string }>;
          if (typeof textItem.str !== "string") return "";
          return textItem.hasEOL ? `${textItem.str}\n` : `${textItem.str} `;
        })
        .join("");

      pageTexts.push(text);
      page.cleanup();
    }
  } finally {
    await pdfDocument.destroy();
  }

  return normalizeExtractedPdfText(pageTexts.join("\n\n"));
}

function normalizeExtractedPdfText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 20000);
}

function installPdfJsNodePolyfills() {
  if (!("DOMMatrix" in globalThis)) {
    Object.defineProperty(globalThis, "DOMMatrix", {
      configurable: true,
      value: class DOMMatrix {
        multiplySelf() {
          return this;
        }

        translateSelf() {
          return this;
        }

        scaleSelf() {
          return this;
        }

        rotateSelf() {
          return this;
        }

        invertSelf() {
          return this;
        }
      },
    });
  }

  if (!("ImageData" in globalThis)) {
    Object.defineProperty(globalThis, "ImageData", {
      configurable: true,
      value: class ImageData {},
    });
  }

  if (!("Path2D" in globalThis)) {
    Object.defineProperty(globalThis, "Path2D", {
      configurable: true,
      value: class Path2D {},
    });
  }
}

function parseInputType(value: unknown): AnalysisInputType {
  return value === "pdf" ||
    value === "image" ||
    value === "camera" ||
    value === "example" ||
    value === "text"
    ? value
    : "text";
}

function getDefaultSourceLabel(inputType: AnalysisInputType, fileValue: FormDataEntryValue | null) {
  if (fileValue instanceof File && fileValue.name) {
    return fileValue.name;
  }

  if (inputType === "pdf") return "Uploaded PDF";
  if (inputType === "camera") return "Camera photo";
  if (inputType === "image") return "Uploaded image";
  if (inputType === "example") return "German letter example";
  return "Pasted letter";
}

function createFileFallbackText(input: AnalyzeRequest) {
  if (input.text) return input.text;

  if (input.inputType === "pdf") {
    return `Uploaded PDF document: ${input.sourceLabel}`;
  }

  if (input.inputType === "camera") {
    return `Camera photo document: ${input.sourceLabel}`;
  }

  if (input.inputType === "image") {
    return `Uploaded image document: ${input.sourceLabel}`;
  }

  return input.sourceLabel;
}

const analysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: { type: "string" },
    summary: { type: "string" },
    source_excerpt: { type: "string" },
    authority_type: {
      enum: [
        "auslaenderbehoerde",
        "finanzamt",
        "jobcenter",
        "krankenkasse",
        "buergeramt",
        "university_bafog",
        "insurance",
        "vehicle_registration",
        "other",
      ],
      type: "string",
    },
    document_type: {
      enum: [
        "appointment",
        "missing_documents",
        "payment_request",
        "objection_deadline",
        "hearing",
        "decision_notice",
        "information_only",
        "application_status",
        "other",
      ],
      type: "string",
    },
    required_action_type: {
      enum: [
        "attend_appointment",
        "submit_documents",
        "pay",
        "reply",
        "file_objection",
        "provide_information",
        "no_action",
        "other",
      ],
      type: "string",
    },
    required_action: { type: "string" },
    deadline: { anyOf: [{ type: "string" }, { type: "null" }] },
    deadline_iso: { anyOf: [{ type: "string" }, { type: "null" }] },
    deadline_evidence: { anyOf: [{ type: "string" }, { type: "null" }] },
    deadline_type: { enum: ["exclusionary", "extendable", "none"], type: "string" },
    consequence_severity: {
      enum: ["financial_penalty", "status_loss", "rejection", "delay_only", "informational"],
      type: "string",
    },
    reply_needed: { type: "boolean" },
    appointment_needed: { type: "boolean" },
    payment_needed: { type: "boolean" },
    payment_amount: { anyOf: [{ type: "string" }, { type: "null" }] },
    payment_iban: { anyOf: [{ type: "string" }, { type: "null" }] },
    proof_needed: { type: "boolean" },
    extension_possible: { type: "boolean" },
    reference_number: { anyOf: [{ type: "string" }, { type: "null" }] },
    risk_level: { enum: ["low", "medium", "high"], type: "string" },
    required_documents: {
      type: "array",
      items: { type: "string" },
    },
    checklist: {
      type: "array",
      minItems: 5,
      maxItems: 7,
      items: { type: "string" },
    },
    recommended_next_step: { type: "string" },
    reply_draft_de: { type: "string" },
    confidence: { enum: ["low", "medium", "high"], type: "string" },
  },
  required: [
    "category",
    "summary",
    "source_excerpt",
    "authority_type",
    "document_type",
    "required_action_type",
    "required_action",
    "deadline",
    "deadline_iso",
    "deadline_evidence",
    "deadline_type",
    "consequence_severity",
    "reply_needed",
    "appointment_needed",
    "payment_needed",
    "payment_amount",
    "payment_iban",
    "proof_needed",
    "extension_possible",
    "reference_number",
    "risk_level",
    "required_documents",
    "checklist",
    "recommended_next_step",
    "reply_draft_de",
    "confidence",
  ],
};
