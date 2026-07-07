import { NextResponse } from "next/server";
import { isStandaloneAuth } from "@/lib/server/standalone-auth";
import {
  assertTokenClaims,
  callbackUrl,
  consumeStateCookie,
  decodeIdTokenPayload,
  decodeState,
  getAppUrl,
  googleConfigured,
  issueSession,
  nativeRedirect,
  sessionFromClaims,
} from "@/lib/server/social-auth";
import { createExchangeToken } from "@/lib/server/auth-exchange";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const appUrl = getAppUrl();
  if (!isStandaloneAuth() || !googleConfigured()) {
    return NextResponse.redirect(`${appUrl}/login?error=google_unavailable`);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const { mode, state } = decodeState(url.searchParams.get("state") ?? "");

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

    const session = sessionFromClaims(payload, "google");

    if (mode === "native") {
      // Session can't be set on the system browser — hand a one-time code to
      // the app via deep link; the app exchanges it inside its WebView.
      const token = createExchangeToken(session);
      return NextResponse.redirect(nativeRedirect("google", token));
    }

    await issueSession(session);
    return NextResponse.redirect(`${appUrl}/`);
  } catch (error) {
    console.error("AmtBrief: Google sign-in failed", error);
    return NextResponse.redirect(`${appUrl}/login?error=google_failed`);
  }
}
