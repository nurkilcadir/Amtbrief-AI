import { randomBytes } from "crypto";
import type { UserSession } from "@/lib/server/auth";

// One-time token handoff for native OAuth. The OAuth flow completes in the
// system browser (where Google/Apple allow it), which cannot set the app's
// WebView cookie. So the callback stashes the resolved session here and
// redirects to a deep link carrying a short-lived code; the app then calls
// /api/auth/exchange from inside the WebView to turn that code into its cookie.
type Entry = { session: UserSession; expiresAt: number };

const store = new Map<string, Entry>();
const TTL_MS = 5 * 60 * 1000;

export function createExchangeToken(session: UserSession) {
  prune();
  const token = randomBytes(24).toString("base64url");
  store.set(token, { session, expiresAt: Date.now() + TTL_MS });
  return token;
}

export function consumeExchangeToken(token: string): UserSession | null {
  const entry = store.get(token);
  store.delete(token);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.session;
}

function prune() {
  const now = Date.now();
  for (const [token, entry] of store) {
    if (entry.expiresAt < now) store.delete(token);
  }
}
