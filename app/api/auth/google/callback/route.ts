import { NextResponse } from "next/server";
import { isStandaloneAuth } from "@/lib/server/standalone-auth";
import {
  assertTokenClaims,
  callbackUrl,
  consumeStateCookie,
  decodeIdTokenPayload,
  getAppUrl,
  googleConfigured,
  issueSession,
  sessionFromClaims,
} from "@/lib/server/social-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const appUrl = getAppUrl();
  if (!isStandaloneAuth() || !googleConfigured()) {
    return NextResponse.redirect(`${appUrl}/login?error=google_unavailable`);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";

  if (url.searchParams.get("error") || !code) {
    return NextResponse.redirect(`${appUrl}/login?error=google_cancelled`);
  }

  if (!(await consumeStateCookie("google", state))) {
    return NextResponse.redirect(`${appUrl}/login?error=state`);
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: callbackUrl("google"),
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Google token exchange failed: ${tokenResponse.status}`);
    }

    const { id_token } = (await tokenResponse.json()) as { id_token?: string };
    if (!id_token) throw new Error("Google response missing id_token");

    const payload = decodeIdTokenPayload(id_token);
    assertTokenClaims(payload, {
      audience: process.env.GOOGLE_CLIENT_ID!,
      issuers: ["https://accounts.google.com", "accounts.google.com"],
    });

    await issueSession(sessionFromClaims(payload, "google"));
    return NextResponse.redirect(`${appUrl}/`);
  } catch (error) {
    console.error("AmtBrief: Google sign-in failed", error);
    return NextResponse.redirect(`${appUrl}/login?error=google_failed`);
  }
}
