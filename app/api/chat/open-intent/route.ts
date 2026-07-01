import { NextResponse } from "next/server";
import { consumeChecklistOpenIntent } from "@/lib/server/open-intents";
import { getCurrentUserId } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getCurrentUserId();
  const intent = consumeChecklistOpenIntent(userId);

  if (!intent) {
    return NextResponse.json({ intent: null });
  }

  return NextResponse.json({
    intent: {
      scanId: intent.scanId,
    },
  });
}
