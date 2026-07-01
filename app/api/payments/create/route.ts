import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  createPaymentTransaction,
  hasPaymentMerchantConfig,
} from "@/lib/server/payment-merchant";
import { createPaymentRecord } from "@/lib/server/payment-store";
import { getCurrentUserId } from "@/lib/server/session";

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

  const userId = await getCurrentUserId();
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");

  if (!appUrl) {
    return NextResponse.json(
      { error: "APP_URL must be set so mPower can call back this app" },
      { status: 503 },
    );
  }

  try {
    const idempotencyId = randomUUID();
    const merchantCallback = `${appUrl}/api/webhooks/payment?scanId=${encodeURIComponent(body.scanId)}`;

    const { transactionId, status } = await createPaymentTransaction({
      amountCents: body.amountCents,
      idempotencyId,
      merchantCallback,
      merchantName: "AmtBrief AI",
      paymentContent: [
        { key: body.description || "Payment", value: formatEuro(body.amountCents) },
      ],
      userId,
    });

    await createPaymentRecord({
      transactionId,
      userId,
      scanId: body.scanId,
      sourceLabel: body.sourceLabel ?? "Official letter",
      amountCents: body.amountCents,
    });

    return NextResponse.json({ ok: true, transactionId, status });
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
