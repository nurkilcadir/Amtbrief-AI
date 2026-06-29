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
    const normalized = normalizeAnalysis(
      parsed,
      prepared.input.text || createFileFallbackText(prepared.input),
    );
    return NextResponse.json(groundSourceExcerpt(normalized, prepared.input.text));
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
            "You are AmtBrief AI, a German bureaucracy copilot. Analyze official German letters and return only valid JSON. Be practical, clear, and non-legal-advice. Checklist must contain 5 to 7 concrete steps. Include source_excerpt as a short recognized excerpt or concise source summary from the original document, useful for identifying the uploaded letter later. The source_excerpt must be copied verbatim from the original document text, not paraphrased. For deadline_iso, return a precise ISO 8601 date (and time, if known) only when the letter states an exact, unambiguous date; otherwise return null and explain in deadline instead.\n\n" +
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
 * Confirms the model's source_excerpt is actually grounded in the original
 * text (rather than hallucinated). Only applicable when we have extracted
 * text to compare against (text input or PDF) - vision-only flows (image,
 * camera) have no original text and are skipped.
 */
function groundSourceExcerpt(
  analysis: ReturnType<typeof normalizeAnalysis>,
  originalText: string,
): ReturnType<typeof normalizeAnalysis> {
  if (!originalText || !analysis.source_excerpt) {
    return analysis;
  }

  const normalizedOriginal = normalizeForComparison(originalText);
  const normalizedExcerpt = normalizeForComparison(
    analysis.source_excerpt.replace(/\.\.\.$/, ""),
  );

  if (!normalizedExcerpt) {
    return analysis;
  }

  if (normalizedOriginal.includes(normalizedExcerpt)) {
    return analysis;
  }

  const overlapRatio = wordOverlapRatio(normalizedExcerpt, normalizedOriginal);

  if (overlapRatio >= 0.6) {
    return analysis;
  }

  console.warn(
    `AmtBrief: source_excerpt failed grounding check (overlap ${overlapRatio.toFixed(2)}), downgrading confidence`,
  );

  return {
    ...analysis,
    confidence: "low",
  };
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
    "Return category, summary, source_excerpt, required action, deadline, risk level, required documents, checklist, recommended next step, German reply draft, and confidence.",
    "source_excerpt should be one short recognized excerpt or concise source summary from the original document so the user can identify this scan later.",
    `Input source: ${input.inputType}.`,
    input.inputType === "pdf"
      ? "The PDF text was extracted locally before analysis."
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
  if (inputType === "example") return "Example letter";
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
    required_action: { type: "string" },
    deadline: { anyOf: [{ type: "string" }, { type: "null" }] },
    deadline_iso: { anyOf: [{ type: "string" }, { type: "null" }] },
    deadline_type: { enum: ["exclusionary", "extendable", "none"], type: "string" },
    consequence_severity: {
      enum: ["financial_penalty", "status_loss", "rejection", "delay_only", "informational"],
      type: "string",
    },
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
    "required_action",
    "deadline",
    "deadline_iso",
    "deadline_type",
    "consequence_severity",
    "risk_level",
    "required_documents",
    "checklist",
    "recommended_next_step",
    "reply_draft_de",
    "confidence",
  ],
};
