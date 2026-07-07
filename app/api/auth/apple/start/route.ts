import { NextResponse } from "next/server";
import { isStandaloneAuth } from "@/lib/server/standalone-auth";
import {
  appleConfigured,
  callbackUrl,
  createState,
  getAppUrl,
  setStateCookie,
} from "@/lib/server/social-auth";

export const runtime = "nodejs";

export async function GET() {
  if (!isStandaloneAuth() || !appleConfigured()) {
    return NextResponse.redirect(`${getAppUrl() || ""}/login?error=apple_unavailable`);
  }

  const state = createState();
  await setStateCookie("apple", state);

  const params = new URLSearchParams({
    client_id: process.env.APPLE_CLIENT_ID!,
    redirect_uri: callbackUrl("apple"),
    response_type: "code",
    scope: "name email",
    // Apple sends the callback as a POST form when name/email scope is used.
    response_mode: "form_post",
    state,
  });

  return NextResponse.redirect(
    `https://appleid.apple.com/auth/authorize?${params.toString()}`,
  );
}
