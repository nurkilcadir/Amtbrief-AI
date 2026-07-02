import { NextResponse } from "next/server";
import { consumeDocumentOpenIntent } from "@/lib/server/open-intents";
import { getCurrentUserId } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getCurrentUserId();
  const intent = consumeDocumentOpenIntent(userId);

  if (!intent) {
    return NextResponse.json({ intent: null });
  }

  return NextResponse.json({
    intent: {
      section: intent.section,
      scanId: intent.scanId,
    },
  });
}
