import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/server/session";
import {
  getLatestSignatureForScan,
  toClientSignature,
} from "@/lib/server/signature-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const scanId = request.nextUrl.searchParams.get("scanId");

  if (!scanId) {
    return NextResponse.json({ error: "scanId is required" }, { status: 400 });
  }

  const userId = await getCurrentUserId();
  const signature = await getLatestSignatureForScan({ scanId, userId });

  return NextResponse.json({
    ok: true,
    signature: toClientSignature(signature),
  });
}
