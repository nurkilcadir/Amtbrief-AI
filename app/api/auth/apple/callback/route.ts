import { NextResponse } from "next/server";
import { isStandaloneAuth } from "@/lib/server/standalone-auth";
import {
  appleConfigured,
  assertTokenClaims,
  buildAppleClientSecret,
  callbackUrl,
  consumeStateCookie,
  decodeIdTokenPayload,
  getAppUrl,
  issueSession,
  sessionFromClaims,
} from "@/lib/server/social-auth";
import type { UserSession } from "@/lib/server/auth";

export const runtime = "nodejs";

// Apple posts the result as a form (response_mode=form_post).
export async function POST(request: Request) {
  const appUrl = getAppUrl();
  if (!isStandaloneAuth() || !appleConfigured()) {
    return NextResponse.redirect(`${appUrl}/login?error=apple_unavailable`, 303);
  }

  const form = await request.formData();
  const code = String(form.get("code") ?? "");
  const state = String(form.get("state") ?? "");
  const userJson = form.get("user"); // present only on the first authorization

  if (form.get("error") || !code) {
    return NextResponse.redirect(`${appUrl}/login?error=apple_cancelled`, 303);
  }

  if (!(await consumeStateCookie("apple", state))) {
    return NextResponse.redirect(`${appUrl}/login?error=state`, 303);
  }

  try {
    const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.APPLE_CLIENT_ID!,
        client_secret: buildAppleClientSecret(),
        code,
        grant_type: "authorization_code",
        redirect_uri: callbackUrl("apple"),
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Apple token exchange failed: ${tokenResponse.status}`);
    }

    const { id_token } = (await tokenResponse.json()) as { id_token?: string };
    if (!id_token) throw new Error("Apple response missing id_token");

    const payload = decodeIdTokenPayload(id_token);
    assertTokenClaims(payload, {
      audience: process.env.APPLE_CLIENT_ID!,
      issuers: ["https://appleid.apple.com"],
    });

    const session = sessionFromClaims(payload, "apple");
    mergeAppleName(session, userJson);

    await issueSession(session);
    return NextResponse.redirect(`${appUrl}/`, 303);
  } catch (error) {
    console.error("AmtBrief: Apple sign-in failed", error);
    return NextResponse.redirect(`${appUrl}/login?error=apple_failed`, 303);
  }
}

// Apple only returns the user's name once, on the very first authorization,
// as a separate `user` form field (the id_token never carries the name).
function mergeAppleName(session: UserSession, userJson: FormDataEntryValue | null) {
  if (typeof userJson !== "string") return;
  try {
    const parsed = JSON.parse(userJson) as {
      name?: { firstName?: string; lastName?: string };
    };
    const first = parsed.name?.firstName;
    const last = parsed.name?.lastName;
    const full = [first, last].filter(Boolean).join(" ");
    if (first) session.givenName = first;
    if (last) session.familyName = last;
    if (full) session.name = full;
  } catch {
    // ignore malformed user payload
  }
}
