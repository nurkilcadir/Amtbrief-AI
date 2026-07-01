import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyUserSession } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const session = verifyUserSession(cookieStore.get("user_session")?.value);

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      user: null,
    });
  }

  const nameParts = getNameParts(session.name);
  const firstName = cleanName(session.givenName) ?? nameParts.firstName;
  const lastName = cleanName(session.familyName) ?? nameParts.lastName;
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    cleanName(session.name) ||
    cleanName(session.preferredUsername) ||
    cleanName(session.email) ||
    "AmtBrief user";

  return NextResponse.json({
    authenticated: true,
    user: {
      displayName,
      email: session.email ?? null,
      firstName,
      lastName,
    },
  });
}

function getNameParts(name: string | undefined) {
  const cleaned = cleanName(name);

  if (!cleaned) {
    return {
      firstName: null,
      lastName: null,
    };
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

function cleanName(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
