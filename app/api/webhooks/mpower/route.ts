import { NextResponse } from "next/server";
import { buildMiniAppShareLink } from "@/lib/server/miniapp-links";
import { hasMpowerConfig, sendPlainMpowerMessage } from "@/lib/server/mpower";
import { rememberDocumentOpenIntent } from "@/lib/server/open-intents";
import { applyPaymentChoice } from "@/lib/server/payment-intents";
import { applyMpowerChoice } from "@/lib/server/reminder-store";
import { applySignatureCallback } from "@/lib/server/signature-store";

export const runtime = "nodejs";

type MpowerCallback = {
  message?: {
    content?: {
      messageContent?: {
        mediaContent?: {
          fileName?: string;
          mediaId?: string;
        };
        messageText?: string;
        signatureStatus?: string;
      };
      mediaContent?: {
        fileName?: string;
        mediaId?: string;
      };
      messageType?: string;
      signatureStatus?: string;
    };
    from?: {
      userId?: string;
    };
  };
};

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    console.error("AmtBrief webhook: failed to parse JSON body");
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const body = rawBody as MpowerCallback;
  const messageType = body.message?.content?.messageType ?? "";
  const userId = body.message?.from?.userId ?? "";

  console.log(
    `AmtBrief webhook: messageType=${messageType} userId=${userId} body=${JSON.stringify(rawBody).slice(0, 800)}`,
  );

  if (messageType === "signatureResponse" && userId) {
    const fileName = getSignatureFileName(body);
    const mediaId = getSignatureMediaId(body);
    const signatureStatus = getSignatureStatus(body);

    console.log(
      `AmtBrief webhook: signatureResponse fileName=${fileName} mediaId=${mediaId} signatureStatus=${signatureStatus}`,
    );

    const result = await applySignatureCallback({
      fileName,
      mediaId,
      signatureStatus,
      userId,
    });

    console.log(`AmtBrief webhook: signatureCallback action=${result.action} signatureId=${result.signature?.id}`);

    if (result.action === "signed" && result.signature && hasMpowerConfig()) {
      rememberDocumentOpenIntent({
        scanId: result.signature.scanId,
        section: "reply",
        userId,
      });

      await sendPlainMpowerMessage({
        messageText: buildSignedReplyMessage({
          scanId: result.signature.scanId,
          sourceLabel: result.signature.sourceLabel,
        }),
        userId,
      }).catch((error) => {
        console.error("AmtBrief webhook: signed reply chat message failed", error);
      });
    }

    return NextResponse.json({
      ok: true,
      action: result.action,
    });
  }

  const responseText = body.message?.content?.messageContent?.messageText ?? "";

  if (messageType !== "choiceResponse" || !responseText || !userId) {
    return NextResponse.json({ ignored: true });
  }

  const appUrl = (process.env.APP_BASE_URL ?? process.env.APP_URL ?? "").replace(/\/$/, "");
  const paymentChoice = appUrl
    ? await applyPaymentChoice({
        appUrl,
        responseText,
        userId,
      }).catch((error) => {
        console.error("AmtBrief webhook: payment choice failed", error);
        return { action: "failed" as const };
      })
    : { action: "ignored" as const };

  if (paymentChoice.action === "payment_created") {
    console.log(
      `AmtBrief webhook: payment transaction created from choice transactionId=${paymentChoice.result.transactionId} status=${paymentChoice.result.status}`,
    );
    return NextResponse.json({
      ok: true,
      action: paymentChoice.action,
      transactionId: paymentChoice.result.transactionId,
    });
  }

  if (paymentChoice.action === "manual_transfer_selected") {
    return NextResponse.json({
      ok: true,
      action: paymentChoice.action,
    });
  }

  if (paymentChoice.action === "missing_intent" && hasMpowerConfig()) {
    await sendPlainMpowerMessage({
      messageText:
        "I could not find an active AmtBrief AI payment request. Please open the document again and start the payment action from the checklist.",
      userId,
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      action: paymentChoice.action,
    });
  }

  const result = await applyMpowerChoice({
    responseText,
    userId,
  });

  if (result.action === "open_requested" && hasMpowerConfig()) {
    await sendPlainMpowerMessage({
      messageText: buildOpenMiniAppMessage(),
      userId,
    }).catch(() => null);
  }

  return NextResponse.json({
    ok: true,
    action: result.action,
  });
}

function getSignatureStatus(body: MpowerCallback) {
  return (
    body.message?.content?.messageContent?.signatureStatus ??
    body.message?.content?.signatureStatus ??
    ""
  );
}

function getSignatureMediaId(body: MpowerCallback) {
  return (
    body.message?.content?.messageContent?.mediaContent?.mediaId ??
    body.message?.content?.mediaContent?.mediaId ??
    null
  );
}

function getSignatureFileName(body: MpowerCallback) {
  return (
    body.message?.content?.messageContent?.mediaContent?.fileName ??
    body.message?.content?.mediaContent?.fileName ??
    null
  );
}

function buildOpenMiniAppMessage() {
  const openLink = buildMiniAppShareLink({
    open: "checklist",
  });

  if (!openLink) {
    return "Open AmtBrief AI in the Deutschland App and review your checklist.";
  }

  return `Open AmtBrief AI and review your checklist: ${openLink}`;
}

function buildSignedReplyMessage(input: { scanId: string; sourceLabel: string }) {
  const title = input.sourceLabel || "your AmtBrief AI reply";
  const openLink = buildMiniAppShareLink({
    open: "reply",
    scanId: input.scanId,
  });

  if (!openLink) {
    return `Your signed PDF is ready for ${title}. Open AmtBrief AI and go to the Reply tab.`;
  }

  return `Your signed PDF is ready for ${title}. Open the Reply tab to download it: ${openLink}`;
}
