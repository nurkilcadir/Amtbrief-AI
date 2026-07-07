import { createHash } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signUserSession, type UserSession } from "@/lib/server/auth";
import { isStandaloneAuth } from "@/lib/server/standalone-auth";

export const runtime = "nodejs";

// Standalone (non-SuperApp) sign-in. In the SuperApp the identity comes from
// Silent SSO; as an independent mobile app there is no injected session, so
// this issues our own signed `user_session` cookie. Guarded by STANDALONE_AUTH
// so it can never be used inside the SuperApp deployment.
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(request: Request) {
  if (!isStandaloneAuth()) {
    return NextResponse.json(
      { error: "Standalone auth is not enabled for this deployment." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    guest?: boolean;
  };

  const email = body.email?.trim().toLowerCase();
  const guest = Boolean(body.guest);

  if (!guest && (!email || !isValidEmail(email))) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const session: UserSession = guest
    ? { sub: `guest:${randomId()}`, name: "Guest" }
    : {
        sub: `standalone:${createHash("sha256").update(email!).digest("hex").slice(0, 32)}`,
        email,
        name: body.name?.trim() || undefined,
      };

  const cookieStore = await cookies();
  cookieStore.set("user_session", signUserSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return NextResponse.json({ ok: true });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function randomId() {
  return createHash("sha256")
    .update(`${Date.now()}-${Math.random()}`)
    .digest("hex")
    .slice(0, 16);
}
