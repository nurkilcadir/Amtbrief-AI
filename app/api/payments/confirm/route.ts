import { NextResponse } from "next/server";
import { hasMpowerConfig, sendPlainMpowerMessage } from "@/lib/server/mpower";
import { getCurrentUserId } from "@/lib/server/session";

export const runtime = "nodejs";

/**
 * Confirms that the user paid an authority directly (bank transfer to the
 * IBAN we showed them) - we never process the payment ourselves. This just
 * logs the confirmation and, if mPower is configured, sends a chat receipt
 * the user can find again later in the SuperApp.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    sourceLabel?: string;
    paymentAmount?: string | null;
    referenceNumber?: string | null;
  };

  const userId = await getCurrentUserId();
  let sent = false;

  if (hasMpowerConfig()) {
    try {
      await sendPlainMpowerMessage({
        messageText: buildConfirmationMessage(body),
        userId,
      });
      sent = true;
    } catch (error) {
      console.error("AmtBrief: payment confirmation chat message failed", error);
    }
  }

  return NextResponse.json({ ok: true, sent });
}

function buildConfirmationMessage(input: {
  sourceLabel?: string;
  paymentAmount?: string | null;
  referenceNumber?: string | null;
}) {
  const title = input.sourceLabel || "this letter";
  const amount = input.paymentAmount ? ` (${input.paymentAmount})` : "";
  const reference = input.referenceNumber
    ? ` Keep the reference ${input.referenceNumber} with your bank receipt.`
    : "";

  return `Payment marked as done for ${title}${amount}.${reference} AmtBrief AI does not process payments itself - this only confirms you sent the transfer yourself. Keep your bank confirmation as proof.`;
}
