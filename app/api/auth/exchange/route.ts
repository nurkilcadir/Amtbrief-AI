import { NextResponse } from "next/server";
import { isStandaloneAuth } from "@/lib/server/standalone-auth";
import { consumeExchangeToken } from "@/lib/server/auth-exchange";
import { issueSession } from "@/lib/server/social-auth";

export const runtime = "nodejs";

// Called from inside the native WebView after a system-browser OAuth flow.
// Turns the one-time code (delivered via deep link) into the user_session
// cookie on the WebView's own request.
export async function POST(request: Request) {
  if (!isStandaloneAuth()) {
    return NextResponse.json({ error: "Not enabled." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const code = body.code?.trim();
  if (!code) {
    return NextResponse.json({ error: "Missing code." }, { status: 400 });
  }

  const session = consumeExchangeToken(code);
  if (!session) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 401 });
  }

  await issueSession(session);
  return NextResponse.json({ ok: true });
}
