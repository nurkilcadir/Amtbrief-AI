import { NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // mPower global callback URL is registered as the app root.
  // Transparently rewrite incoming POST / to the actual webhook handler.
  if (request.method === "POST" && pathname === "/") {
    const webhookUrl = request.nextUrl.clone();
    webhookUrl.pathname = "/api/webhooks/mpower";
    return NextResponse.rewrite(webhookUrl);
  }

  // Standalone (independent mobile app): use our own /login screen instead of
  // the SuperApp's Silent SSO. Everything else stays gated behind a session.
  if (isStandaloneAuth()) {
    if (isPublicPath(pathname) || pathname === "/login") {
      return continueRequest(pathname);
    }

    const sessionCookie = request.cookies.get("user_session")?.value;
    if (sessionCookie && (await isSessionValid(sessionCookie))) {
      return continueRequest(pathname);
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    const response = NextResponse.redirect(loginUrl);
    if (sessionCookie) response.cookies.delete("user_session");
    return response;
  }

  if (!isOidcEnabled() || isPublicPath(pathname)) {
    return continueRequest(pathname);
  }

  const sessionCookie = request.cookies.get("user_session")?.value;

  if (sessionCookie) {
    const valid = await isSessionValid(sessionCookie);
    if (valid) {
      return continueRequest(pathname);
    }
    // Cookie present but invalid (stale secret) → clear it and re-login
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/api/auth/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("user_session");
    return response;
  }

  const url = request.nextUrl.clone();
  url.pathname = "/api/auth/login";
  url.search = "";
  url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

function isStandaloneAuth() {
  return (
    process.env.STANDALONE_AUTH === "1" ||
    process.env.STANDALONE_AUTH === "true" ||
    process.env.NEXT_PUBLIC_STANDALONE_AUTH === "1" ||
    process.env.NEXT_PUBLIC_STANDALONE_AUTH === "true"
  );
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|miniApp.json|samples).*)"],
};

async function isSessionValid(value: string): Promise<boolean> {
  try {
    const dotIndex = value.indexOf(".");
    if (dotIndex === -1) return false;

    const payload = value.slice(0, dotIndex);
    const signature = value.slice(dotIndex + 1);

    const secret = process.env.ADMIN_SESSION_SECRET ?? "dev-session-secret-change-before-production";
    const keyData = new TextEncoder().encode(secret);
    const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const payloadData = new TextEncoder().encode(payload);
    const sigBytes = await crypto.subtle.sign("HMAC", key, payloadData);
    const expected = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    return expected === signature;
  } catch {
    return false;
  }
}

function isOidcEnabled() {
  return Boolean(
    process.env.OIDC_ISSUER &&
      process.env.OIDC_CLIENT_ID &&
      process.env.OIDC_CLIENT_SECRET &&
      process.env.APP_BASE_URL,
  );
}

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/reminders/run") ||
    pathname.startsWith("/api/webhooks/mpower") ||
    pathname.startsWith("/api/webhooks/payment")
  );
}

function continueRequest(pathname: string) {
  const response = NextResponse.next();

  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, max-age=0, must-revalidate",
  );
  response.headers.set("Pragma", "no-cache");

  return response;
}
