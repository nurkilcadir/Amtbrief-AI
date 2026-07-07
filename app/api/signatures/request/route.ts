import { NextResponse } from "next/server";
import { buildMiniAppShareLink } from "@/lib/server/miniapp-links";
import { hasMpowerConfig, sendSignatureRequest } from "@/lib/server/mpower";
import { createReplyPdf } from "@/lib/server/reply-pdf";
import { getCurrentUserId } from "@/lib/server/session";
import {
  createSignatureRequestRecord,
  markSignatureFailed,
  markSignatureSent,
  toClientSignature,
} from "@/lib/server/signature-store";
import type { AnalysisResult } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    analysis?: AnalysisResult;
    replyDraft?: string;
    scanId?: string;
    sourceLabel?: string;
  };

  if (!body.scanId || !body.analysis || !body.replyDraft?.trim()) {
    return NextResponse.json(
      { error: "scanId, analysis, and replyDraft are required" },
      { status: 400 },
    );
  }

  if (!hasMpowerConfig()) {
    return NextResponse.json(
      { error: "mPower signature is not configured for this environment" },
      { status: 503 },
    );
  }

  const callbackUrl = getMpowerCallbackUrl(request);
  const userId = await getCurrentUserId();

  console.log(`AmtBrief signature request: userId=${userId} callbackUrl=${callbackUrl} scanId=${body.scanId}`);
  const signature = await createSignatureRequestRecord({
    scanId: body.scanId,
    sourceLabel: body.sourceLabel ?? "Official letter",
    userId,
  });

  try {
    const pdf = await createReplyPdf({
      analysis: body.analysis,
      replyDraft: body.replyDraft,
      sourceLabel: body.sourceLabel ?? "Official letter",
    });
    const result = await sendSignatureRequest({
      callbackUrl,
      fileName: signature.fileName,
      messageText: buildSignatureMessage(body.sourceLabel, body.analysis),
      pdf: pdf.pdfBytes,
      signaturePageNumber: pdf.signaturePageNumber,
      userId,
    });
    const updated = await markSignatureSent({
      id: signature.id,
      mpowerInstanceId: result.instanceId,
      mpowerMessageId: result.messageId,
    });
    console.log(
      `AmtBrief signature request sent messageId=${result.messageId ?? "unknown"} instanceId=${result.instanceId ?? "unknown"} signatureId=${signature.id}`,
    );

    const chatDeepLink = buildMiniAppShareLink();

    return NextResponse.json({
      ok: true,
      chatDeepLink,
      signature: toClientSignature(updated ?? signature),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signature request failed";
    console.error("AmtBrief: signature request failed", error);
    const failed = await markSignatureFailed(signature.id, message);

    return NextResponse.json(
      {
        error: "Could not send the signature request",
        signature: toClientSignature(failed ?? signature),
      },
      { status: 502 },
    );
  }
}

function getMpowerCallbackUrl(request: Request) {
  if (process.env.MPOWER_CALLBACK_URL) {
    return process.env.MPOWER_CALLBACK_URL;
  }

  if (process.env.APP_BASE_URL) {
    return `${process.env.APP_BASE_URL.replace(/\/$/, "")}/api/webhooks/mpower`;
  }

  return `${new URL(request.url).origin}/api/webhooks/mpower`;
}

function buildSignatureMessage(sourceLabel: string | undefined, analysis: AnalysisResult) {
  const title = sourceLabel || analysis.category || "your AmtBrief reply";
  const deadline = analysis.deadline ? ` Deadline: ${analysis.deadline}.` : "";

  return `Please sign the AmtBrief AI reply PDF for ${title}.${deadline}`;
}
