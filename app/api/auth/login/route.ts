import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createOidcAuthUrl, createPkce, isOidcEnabled } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isOidcEnabled()) {
    const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "");
    return NextResponse.redirect(baseUrl ? `${baseUrl}/` : new URL("/", request.url));
  }

  const next = request.nextUrl.searchParams.get("next") || "/";
  const state = randomBytes(16).toString("hex");
  const nonce = randomBytes(16).toString("hex");
  const { challenge, verifier } = createPkce();
  const response = NextResponse.redirect(
    createOidcAuthUrl({
      challenge,
      nonce,
      state,
    }),
  );

  response.cookies.set("oidc_tx", JSON.stringify({ next, nonce, state, verifier }), {
    httpOnly: true,
    maxAge: 10 * 60,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
