import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // Building the redirect target from request.url resolves to the
  // container's internal origin (e.g. http://localhost:3000) behind the
  // platform's reverse proxy, which is unreachable from the outside.
  // APP_BASE_URL is the real public origin and must be used instead.
  const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "");
  const redirectUrl = baseUrl ? `${baseUrl}/` : new URL("/", request.url);

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete("user_session");
  response.cookies.delete("oidc_tx");
  return response;
}
