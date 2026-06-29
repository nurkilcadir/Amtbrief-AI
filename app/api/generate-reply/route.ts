import { NextResponse } from "next/server";
import { buildMockReply } from "@/lib/mock-ai";
import { AnalysisResult, ReplyTone } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    analysis?: AnalysisResult;
    tone?: ReplyTone;
  };
  const tone = body.tone ?? "polite";

  if (!body.analysis) {
    return NextResponse.json(
      { error: "analysis is required" },
      { status: 400 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      reply_draft_de: buildMockReply(body.analysis, tone),
    });
  }

  try {
    const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    );
    const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Create a concise formal German reply for an official authority letter. Return only JSON: {\"reply_draft_de\":\"string\"}. Use placeholders for name, file number, and missing personal data. Do not provide legal advice.",
          },
          {
            role: "user",
            content: JSON.stringify({ tone, analysis: body.analysis }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error("OpenAI-compatible reply request failed");
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    const parsed = content ? (JSON.parse(content) as { reply_draft_de?: string }) : {};

    return NextResponse.json({
      reply_draft_de:
        typeof parsed.reply_draft_de === "string"
          ? parsed.reply_draft_de
          : buildMockReply(body.analysis, tone),
    });
  } catch {
    return NextResponse.json({
      reply_draft_de: buildMockReply(body.analysis, tone),
    });
  }
}
