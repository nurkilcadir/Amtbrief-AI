import { NextResponse } from "next/server";
import { isStandaloneAuth } from "@/lib/server/standalone-auth";
import {
  callbackUrl,
  createState,
  encodeState,
  getAppUrl,
  googleConfigured,
  setStateCookie,
} from "@/lib/server/social-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isStandaloneAuth() || !googleConfigured()) {
    return NextResponse.redirect(`${getAppUrl() || ""}/login?error=google_unavailable`);
  }

  const mode = new URL(request.url).searchParams.get("mode") === "native" ? "native" : "web";
  const state = createState();
  await setStateCookie("google", state);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl("google"),
    response_type: "code",
    scope: "openid email profile",
    state: encodeState(mode, state),
    access_type: "online",
    prompt: "select_account",
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}
