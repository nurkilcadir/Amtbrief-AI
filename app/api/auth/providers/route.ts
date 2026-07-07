import { NextResponse } from "next/server";
import { isStandaloneAuth } from "@/lib/server/standalone-auth";
import { appleConfigured, googleConfigured } from "@/lib/server/social-auth";

export const runtime = "nodejs";

// Lets the login screen show only the sign-in methods that are actually
// configured for this deployment (read at runtime, so one build can serve
// both the SuperApp MiniApp and the standalone app with different env).
export async function GET() {
  const standalone = isStandaloneAuth();
  return NextResponse.json({
    standalone,
    google: standalone && googleConfigured(),
    apple: standalone && appleConfigured(),
    email: standalone,
  });
}
