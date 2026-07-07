import { NextResponse } from "next/server";
import { buildChecklistChatMessage } from "@/lib/chat-summary";
import { buildMiniAppShareLink } from "@/lib/server/miniapp-links";
import { hasMpowerConfig, sendChoiceMpowerMessage } from "@/lib/server/mpower";
import { rememberChecklistOpenIntent } from "@/lib/server/open-intents";
import { getCurrentUserId } from "@/lib/server/session";
import type { AnalysisResult } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    analysis?: AnalysisResult;
    documentText?: string;
    scanId?: string;
    sourceLabel?: string;
  };

  if (!body.scanId || !body.analysis) {
    return NextResponse.json(
      { error: "scanId and analysis are required" },
      { status: 400 },
    );
  }

  if (!hasMpowerConfig()) {
    console.warn("AmtBrief: checklist chat summary skipped — mPower not configured");
    return NextResponse.json({ ok: true, sent: false, skipped: "mPower not configured" });
  }

  const userId = await getCurrentUserId();
  console.log(`AmtBrief: checklist chat summary → userId=${userId} scanId=${body.scanId}`);
  const messageText = buildChecklistChatMessage({
    analysis: body.analysis,
    documentText: body.documentText,
    openLink: getMiniAppOpenLink(body.scanId),
    sourceLabel: body.sourceLabel,
  });

  try {
    const result = await sendChoiceMpowerMessage({
      choices: ["Open checklist"],
      messageText,
      userId,
    });
    console.log(
      `AmtBrief: checklist chat summary sent messageId=${result.messageId ?? "unknown"} instanceId=${result.instanceId ?? "unknown"}`,
    );
    rememberChecklistOpenIntent({
      scanId: body.scanId,
      userId,
    });

    return NextResponse.json({
      ok: true,
      sent: true,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("AmtBrief: checklist chat summary failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Checklist chat summary could not be sent",
        ok: false,
      },
      { status: 502 },
    );
  }
}

function getMiniAppOpenLink(scanId: string) {
  return buildMiniAppShareLink({
    open: "checklist",
    scanId,
  });
}
