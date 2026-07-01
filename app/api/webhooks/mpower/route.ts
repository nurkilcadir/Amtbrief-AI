import { NextResponse } from "next/server";
import { hasMpowerConfig, sendPlainMpowerMessage } from "@/lib/server/mpower";
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

    return NextResponse.json({
      ok: true,
      action: result.action,
    });
  }

  const responseText = body.message?.content?.messageContent?.messageText ?? "";

  if (messageType !== "choiceResponse" || !responseText || !userId) {
    return NextResponse.json({ ignored: true });
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
  const shareBase = process.env.MINIAPP_SHARE_BASE;
  const serviceId = process.env.MPOWER_SERVICE_UUID ?? process.env.OIDC_CLIENT_ID;

  if (!shareBase || !serviceId) {
    return "Open AmtBrief AI in the SuperApp and review your checklist.";
  }

  return `Open AmtBrief AI and review your checklist: ${shareBase}${serviceId}`;
}
