import {
  PDFDocument,
  PDFFont,
  PDFPage,
  PageSizes,
  rgb,
  StandardFonts,
} from "pdf-lib";
import type { AnalysisResult } from "@/lib/types";

type ReplyPdfInput = {
  analysis: AnalysisResult;
  generatedAt?: Date;
  replyDraft: string;
  sourceLabel: string;
};

type ReplyPdfResult = {
  pdfBytes: Uint8Array;
  signaturePageNumber: number;
};

const pageSize = PageSizes.A4;
const marginX = 50;
const contentBottomY = 178;
const signatureBottomY = 86;

export async function createReplyPdf(input: ReplyPdfInput): Promise<ReplyPdfResult> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages: PDFPage[] = [];

  let page = addPage(pdfDoc, pages);
  let y = page.getHeight() - 58;

  y = drawHeader(page, {
    bold,
    generatedAt: input.generatedAt ?? new Date(),
    regular,
    sourceLabel: input.sourceLabel,
    y,
  });

  y = drawInfoBlock(page, {
    analysis: input.analysis,
    bold,
    regular,
    y,
  });

  y -= 12;
  page.drawText("Antwortentwurf", {
    x: marginX,
    y,
    size: 13,
    font: bold,
    color: rgb(0.08, 0.13, 0.22),
  });
  y -= 22;

  const draftLines = wrapText(sanitizePdfText(input.replyDraft), regular, 11, 492);
  for (const line of draftLines) {
    if (y < contentBottomY) {
      page = addPage(pdfDoc, pages);
      y = page.getHeight() - 64;
    }

    if (line) {
      page.drawText(line, {
        x: marginX,
        y,
        size: 11,
        font: regular,
        color: rgb(0.13, 0.18, 0.28),
      });
    }
    y -= line ? 16 : 10;
  }

  if (y < contentBottomY) {
    page = addPage(pdfDoc, pages);
  }

  drawSignatureBlock(page, { bold, regular });
  drawFooters(pages, regular);

  return {
    pdfBytes: await pdfDoc.save(),
    signaturePageNumber: pages.length,
  };
}

function addPage(pdfDoc: PDFDocument, pages: PDFPage[]) {
  const page = pdfDoc.addPage(pageSize);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
    color: rgb(0.98, 0.99, 1),
  });
  pages.push(page);
  return page;
}

function drawHeader(
  page: PDFPage,
  input: {
    bold: PDFFont;
    generatedAt: Date;
    regular: PDFFont;
    sourceLabel: string;
    y: number;
  },
) {
  page.drawText("AmtBrief AI", {
    x: marginX,
    y: input.y,
    size: 10,
    font: input.bold,
    color: rgb(0.1, 0.28, 0.58),
  });
  page.drawText("Offizieller Antwortentwurf", {
    x: marginX,
    y: input.y - 24,
    size: 20,
    font: input.bold,
    color: rgb(0.07, 0.11, 0.2),
  });
  page.drawText(`Erstellt am ${formatGermanDate(input.generatedAt)}`, {
    x: marginX,
    y: input.y - 44,
    size: 9,
    font: input.regular,
    color: rgb(0.38, 0.45, 0.55),
  });
  page.drawText(truncatePdfLine(sanitizePdfText(input.sourceLabel), 54), {
    x: marginX,
    y: input.y - 60,
    size: 9,
    font: input.regular,
    color: rgb(0.38, 0.45, 0.55),
  });

  return input.y - 92;
}

function drawInfoBlock(
  page: PDFPage,
  input: {
    analysis: AnalysisResult;
    bold: PDFFont;
    regular: PDFFont;
    y: number;
  },
) {
  const rows = [
    ["Kategorie", input.analysis.category],
    ["Aktenzeichen / Referenz", input.analysis.reference_number ?? "Bitte ergaenzen"],
    ["Frist", input.analysis.deadline ?? "Keine eindeutige Frist erkannt"],
    ["Naechster Schritt", input.analysis.recommended_next_step],
  ];
  let y = input.y;

  page.drawRectangle({
    x: marginX,
    y: y - 86,
    width: 495,
    height: 102,
    borderWidth: 0.75,
    borderColor: rgb(0.82, 0.87, 0.94),
    color: rgb(1, 1, 1),
  });

  for (const [label, value] of rows) {
    page.drawText(label, {
      x: marginX + 14,
      y,
      size: 8,
      font: input.bold,
      color: rgb(0.33, 0.41, 0.52),
    });
    page.drawText(truncatePdfLine(sanitizePdfText(value), 76), {
      x: marginX + 140,
      y,
      size: 9,
      font: input.regular,
      color: rgb(0.08, 0.13, 0.22),
    });
    y -= 23;
  }

  return y - 18;
}

function drawSignatureBlock(
  page: PDFPage,
  input: {
    bold: PDFFont;
    regular: PDFFont;
  },
) {
  page.drawText("Mit freundlichen Gruessen", {
    x: marginX,
    y: 150,
    size: 11,
    font: input.regular,
    color: rgb(0.13, 0.18, 0.28),
  });
  page.drawLine({
    start: { x: marginX, y: signatureBottomY },
    end: { x: marginX + 250, y: signatureBottomY },
    thickness: 0.8,
    color: rgb(0.13, 0.18, 0.28),
  });
  page.drawText("Unterschrift", {
    x: marginX,
    y: signatureBottomY - 16,
    size: 8,
    font: input.bold,
    color: rgb(0.38, 0.45, 0.55),
  });
  page.drawLine({
    start: { x: marginX + 305, y: signatureBottomY },
    end: { x: marginX + 455, y: signatureBottomY },
    thickness: 0.8,
    color: rgb(0.13, 0.18, 0.28),
  });
  page.drawText("Ort, Datum", {
    x: marginX + 305,
    y: signatureBottomY - 16,
    size: 8,
    font: input.bold,
    color: rgb(0.38, 0.45, 0.55),
  });
}

function drawFooters(pages: PDFPage[], regular: PDFFont) {
  pages.forEach((page, index) => {
    page.drawText(
      `Seite ${index + 1} von ${pages.length} - Erstellt mit AmtBrief AI`,
      {
        x: marginX,
        y: 34,
        size: 8,
        font: regular,
        color: rgb(0.55, 0.62, 0.72),
      },
    );
  });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }

    if (line) lines.push(line);
  }

  return lines;
}

function sanitizePdfText(value: string) {
  const replacements: Record<string, string> = {
    "–": "-",
    "—": "-",
    "“": '"',
    "”": '"',
    "„": '"',
    "’": "'",
    "‘": "'",
    "ı": "i",
    "İ": "I",
    "ğ": "g",
    "Ğ": "G",
    "ş": "s",
    "Ş": "S",
    "ç": "c",
    "Ç": "C",
    "✓": "x",
  };

  return value
    .normalize("NFKC")
    .replace(/[–—“”„’‘ıİğĞşŞçÇ✓]/g, (char) => replacements[char] ?? "")
    .replace(/[^\n\r\t\u0020-\u007e\u00a0-\u00ff€]/g, "");
}

function truncatePdfLine(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function formatGermanDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
