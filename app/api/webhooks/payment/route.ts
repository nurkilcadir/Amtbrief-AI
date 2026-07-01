import { NextRequest, NextResponse } from "next/server";
import { isPaymentFinished } from "@/lib/server/payment-merchant";
import { getPaymentByTransactionId, updatePaymentStatus } from "@/lib/server/payment-store";
import { markScanRemindersHandled } from "@/lib/server/reminder-store";
import { hasMpowerConfig, sendPlainMpowerMessage } from "@/lib/server/mpower";

export const runtime = "nodejs";

type PaymentCallback = {
  transactionId?: string;
  status?: string;
  transactionStatus?: string;
  message?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as PaymentCallback;
  const scanId = request.nextUrl.searchParams.get("scanId");

  if (!body.transactionId) {
    return NextResponse.json({ ignored: true });
  }

  const rawStatus = body.transactionStatus ?? body.status ?? null;
  const finished = isPaymentFinished(rawStatus);

  const record = await updatePaymentStatus({
    transactionId: body.transactionId,
    status: finished ? "finished" : "failed",
    rawStatus,
  });

  if (finished && record) {
    await markScanRemindersHandled({
      scanId: scanId ?? record.scanId,
      userId: record.userId,
    }).catch(() => null);

    if (hasMpowerConfig()) {
      await sendPlainMpowerMessage({
        messageText: `Payment confirmed for ${record.sourceLabel} (${(record.amountCents / 100).toFixed(2)} EUR). This was a platform demo transaction.`,
        userId: record.userId,
      }).catch(() => null);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const transactionId = request.nextUrl.searchParams.get("transactionId");

  if (!transactionId) {
    return NextResponse.json({ error: "transactionId is required" }, { status: 400 });
  }

  const record = await getPaymentByTransactionId(transactionId);
  return NextResponse.json({ ok: true, transaction: record });
}
