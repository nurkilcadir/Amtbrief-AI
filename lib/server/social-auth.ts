import { createPrivateKey, createSign, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { signUserSession, type UserSession } from "@/lib/server/auth";

// Social sign-in (Google / Apple) for the STANDALONE mobile app only.
// In the SuperApp MiniApp, identity comes from Silent SSO and none of this
// runs — every route here also checks isStandaloneAuth().
//
// Security model: the OAuth *code* is exchanged server-to-server directly with
// Google/Apple over TLS, so the returned id_token can be trusted without a
// separate JWKS signature check (per Google's own guidance). We still validate
// state (CSRF), audience, issuer and expiry.

export const OAUTH_STATE_COOKIE = "oauth_state";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const STATE_MAX_AGE = 60 * 10; // 10 min

// Custom URL scheme the native app registers, so the system-browser OAuth flow
// can hand control back to the app via a deep link.
export const NATIVE_SCHEME = "amtbrief";

export type OAuthMode = "web" | "native";

// Mode travels in the OAuth `state` param (round-tripped by Google/Apple) so
// the callback knows whether to set a cookie (web) or hand back a code (native)
// — without changing the state cookie format.
export function encodeState(mode: OAuthMode, state: string) {
  return `${mode}~${state}`;
}

export function decodeState(returned: string): { mode: OAuthMode; state: string } {
  const idx = returned.indexOf("~");
  if (idx === -1) return { mode: "web", state: returned };
  const mode = returned.slice(0, idx) === "native" ? "native" : "web";
  return { mode, state: returned.slice(idx + 1) };
}

export function nativeRedirect(provider: string, code: string) {
  return `${NATIVE_SCHEME}://auth?provider=${encodeURIComponent(provider)}&code=${encodeURIComponent(code)}`;
}

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function appleConfigured() {
  return Boolean(
    process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_PRIVATE_KEY,
  );
}

export function getAppUrl() {
  const url = process.env.APP_URL ?? process.env.APP_BASE_URL ?? "";
  return url.replace(/\/$/, "");
}

export function callbackUrl(provider: "google" | "apple") {
  return `${getAppUrl()}/api/auth/${provider}/callback`;
}

export function createState() {
  return randomBytes(24).toString("base64url");
}

export async function setStateCookie(provider: string, state: string) {
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, `${provider}:${state}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_MAX_AGE,
  });
}

export async function consumeStateCookie(provider: string, state: string) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);
  return raw === `${provider}:${state}`;
}

export async function issueSession(session: UserSession) {
  const cookieStore = await cookies();
  cookieStore.set("user_session", signUserSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function decodeIdTokenPayload(idToken: string) {
  const payload = idToken.split(".")[1];
  if (!payload) throw new Error("Malformed id_token");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    aud?: string | string[];
    email?: string;
    email_verified?: boolean | string;
    exp?: number;
    family_name?: string;
    given_name?: string;
    iss?: string;
    name?: string;
    sub?: string;
  };
}

export function assertTokenClaims(
  payload: ReturnType<typeof decodeIdTokenPayload>,
  expected: { issuers: string[]; audience: string },
) {
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud ?? ""];
  if (!aud.includes(expected.audience)) {
    throw new Error("id_token audience mismatch");
  }
  if (!payload.iss || !expected.issuers.includes(payload.iss)) {
    throw new Error("id_token issuer mismatch");
  }
  if (!payload.exp || payload.exp * 1000 <= Date.now()) {
    throw new Error("id_token expired");
  }
  if (!payload.sub) {
    throw new Error("id_token missing sub");
  }
}

// Apple requires the OAuth client_secret to be a short-lived ES256 JWT signed
// with your .p8 private key.
export function buildAppleClientSecret() {
  const teamId = requireEnv("APPLE_TEAM_ID");
  const keyId = requireEnv("APPLE_KEY_ID");
  const clientId = requireEnv("APPLE_CLIENT_ID");
  const privateKeyPem = normalizePem(requireEnv("APPLE_PRIVATE_KEY"));

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 60 * 10,
    aud: "https://appleid.apple.com",
    sub: clientId,
  };

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = createPrivateKey(privateKeyPem);
  // JOSE requires the raw (r||s) signature, not DER — ieee-p1363 gives us that.
  const signature = signEs256(signingInput, key);
  return `${signingInput}.${signature}`;
}

function signEs256(input: string, key: ReturnType<typeof createPrivateKey>) {
  const signer = createSign("SHA256");
  signer.update(input);
  signer.end();
  const der = signer.sign({ key, dsaEncoding: "ieee-p1363" });
  return der.toString("base64url");
}

function normalizePem(value: string) {
  // Allow the key to be provided with literal \n (common in env vars).
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

function b64url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required`);
  return value;
}

export function sessionFromClaims(payload: ReturnType<typeof decodeIdTokenPayload>, provider: string): UserSession {
  return {
    sub: `${provider}:${payload.sub}`,
    email: payload.email,
    name:
      payload.name ||
      [payload.given_name, payload.family_name].filter(Boolean).join(" ") ||
      undefined,
    givenName: payload.given_name,
    familyName: payload.family_name,
  };
}
