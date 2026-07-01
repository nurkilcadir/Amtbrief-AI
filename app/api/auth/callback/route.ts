import { NextRequest, NextResponse } from "next/server";
import {
  exchangeOidcCode,
  signUserSession,
  verifyIdToken,
} from "@/lib/server/auth";

export const runtime = "nodejs";

type OidcTransaction = {
  next?: string;
  nonce?: string;
  state?: string;
  verifier?: string;
};

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const transaction = parseTransaction(request.cookies.get("oidc_tx")?.value);

  if (!code || !state || !transaction?.state || !transaction.verifier || !transaction.nonce) {
    return NextResponse.json({ error: "Invalid OIDC callback" }, { status: 400 });
  }

  if (state !== transaction.state) {
    return NextResponse.json({ error: "OIDC state mismatch" }, { status: 400 });
  }

  const tokens = await exchangeOidcCode({
    code,
    verifier: transaction.verifier,
  });

  if (!tokens.id_token) {
    return NextResponse.json({ error: "OIDC response did not include id_token" }, { status: 400 });
  }

  const session = await verifyIdToken(tokens.id_token, transaction.nonce);
  const redirectUrl = buildRedirectUrl(getSafeNextPath(transaction.next), request);
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set("user_session", signUserSession(session), {
    httpOnly: true,
    maxAge: 8 * 60 * 60,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.delete("oidc_tx");

  return response;
}

function parseTransaction(value: string | undefined): OidcTransaction | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as OidcTransaction;
  } catch {
    return null;
  }
}

function getSafeNextPath(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  return next;
}

/**
 * Builds an absolute redirect URL using APP_BASE_URL (the real public
 * origin) instead of request.url, which resolves to the container's
 * internal origin (e.g. http://localhost:3000) behind the platform's
 * reverse proxy and is unreachable from the outside. This is the final
 * redirect after a real OIDC login completes, so getting it wrong breaks
 * Silent SSO in production even though the session cookie still gets set.
 */
function buildRedirectUrl(path: string, request: NextRequest) {
  const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "");
  return baseUrl ? `${baseUrl}${path}` : new URL(path, request.url);
}
