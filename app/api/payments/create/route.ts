import { NextResponse } from "next/server";
import { hasPaymentMerchantConfig } from "@/lib/server/payment-merchant";
import { sendChoiceMpowerMessage, hasMpowerConfig } from "@/lib/server/mpower";
import { rememberPendingPaymentIntent } from "@/lib/server/payment-intents";
import { getRequiredCurrentUserId } from "@/lib/server/session";

export const runtime = "nodejs";

/**
 * Creates a REAL mPower payment transaction via this MiniApp's merchant
 * client. This is a platform-payment-flow demo: the funds settle into this
 * MiniApp's own merchant wallet, not the actual German authority's account.
 * The real way to pay the authority is the IBAN bank transfer shown in the
 * Payment card - this endpoint exists to demonstrate mPower's payment rail.
 */
export async function POST(request: Request) {
  if (!hasPaymentMerchantConfig()) {
    return NextResponse.json(
      {
        error:
          "Payment merchant config is missing. Set PAYMENT_BASE_URL, PAYMENT_MERCHANT_ID, PAYMENT_MERCHANT_SECRET, PAYMENT_TENANT_ID, and OIDC_ISSUER.",
      },
      { status: 503 },
    );
  }

  if (!hasMpowerConfig()) {
    return NextResponse.json(
      {
        error:
          "mPower chat config is missing. Payment starts from a Deutschland App chat action.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    scanId?: string;
    sourceLabel?: string;
    amountCents?: number;
    description?: string;
  };

  if (!body.scanId || !body.amountCents || body.amountCents <= 0) {
    return NextResponse.json(
      { error: "scanId and a positive amountCents are required" },
      { status: 400 },
    );
  }

  const userId = await getRequiredCurrentUserId();

  if (!userId) {
    return NextResponse.json(
      {
        error:
          "Payment can only be started inside the Deutschland App with an active user session. Please close and reopen the MiniApp, then try again.",
      },
      { status: 401 },
    );
  }

  const appUrl = (process.env.APP_BASE_URL ?? process.env.APP_URL ?? "").replace(/\/$/, "");

  if (!appUrl) {
    return NextResponse.json(
      { error: "APP_BASE_URL or APP_URL must be set so mPower can call back this app" },
      { status: 503 },
    );
  }

  try {
    const intent = await rememberPendingPaymentIntent({
      amountCents: body.amountCents,
      description: body.description,
      scanId: body.scanId,
      sourceLabel: body.sourceLabel,
      userId,
    });

    console.log(
      `AmtBrief: sending payment choice intentId=${intent.id} scanId=${body.scanId} userId=${userId} amountCents=${body.amountCents}`,
    );

    const message = await sendChoiceMpowerMessage({
      choices: ["Pay now in Deutschland App", "Use manual bank transfer"],
      messageText: buildPaymentChoiceMessage({
        amountCents: body.amountCents,
        sourceLabel: body.sourceLabel,
      }),
      userId,
    });

    return NextResponse.json({
      ok: true,
      intentId: intent.id,
      messageId: message.messageId,
      status: "choice_sent",
    });
  } catch (error) {
    console.error("AmtBrief: payment transaction creation failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Payment transaction could not be created",
      },
      { status: 502 },
    );
  }
}

function formatEuro(cents: number) {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

function buildPaymentChoiceMessage(input: {
  amountCents: number;
  sourceLabel?: string;
}) {
  const title = input.sourceLabel || "your official letter";
  return [
    `AmtBrief AI detected a payment in ${title}.`,
    `Amount: ${formatEuro(input.amountCents)}`,
    "",
    "Choose how you want to continue.",
    "Use manual bank transfer if you want to pay the authority via the IBAN shown in the letter.",
  ].join("\n");
}
