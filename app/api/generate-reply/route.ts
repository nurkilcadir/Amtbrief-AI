import { NextResponse } from "next/server";
import { buildMockReply } from "@/lib/mock-ai";
import {
  buildReplyDraft,
  buildReplyPlan,
  validateReplyDraft,
} from "@/lib/reply";
import { AnalysisResult, ReplyTone } from "@/lib/types";

export const runtime = "nodejs";

type ReplyProvider = {
  baseUrl: string;
  headers: Record<string, string>;
  model: string;
};

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

  const ruleBasedDraft = buildReplyDraft(body.analysis, tone);
  const replyPlan = buildReplyPlan(body.analysis, tone);
  const provider = getReplyProvider();

  if (!provider) {
    return NextResponse.json({
      reply_draft_de: ruleBasedDraft,
    });
  }

  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: provider.headers,
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.15,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You polish German official-letter reply drafts for AmtBrief AI. Return only JSON: {\"reply_draft_de\":\"string\"}. Preserve the provided rule-based intent, facts, placeholders, deadline, reference number, and requested documents. Do not add legal advice, legal arguments, payment promises, admissions of debt/liability/guilt, attachments, personal facts, or deadlines that are not in the draft. Keep the result concise, formal, and ready for user review.",
          },
          {
            role: "user",
            content: JSON.stringify({
              tone,
              reply_plan: replyPlan,
              rule_based_draft: ruleBasedDraft,
            }),
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
          ? validateReplyDraft(parsed.reply_draft_de, ruleBasedDraft)
          : ruleBasedDraft,
    });
  } catch {
    return NextResponse.json({
      reply_draft_de: buildMockReply(body.analysis, tone),
    });
  }
}

function getReplyProvider(): ReplyProvider | null {
  if (process.env.OPENAI_API_KEY) {
    return {
      baseUrl: (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    };
  }

  if (process.env.OPENROUTER_API_KEY) {
    return {
      baseUrl: "https://openrouter.ai/api/v1",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL ?? "http://localhost:4173",
        "X-Title": "AmtBrief AI",
      },
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-mini",
    };
  }

  return null;
}
