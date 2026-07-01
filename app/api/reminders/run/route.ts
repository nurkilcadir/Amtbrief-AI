import { NextRequest, NextResponse } from "next/server";
import { runDueReminderBatch } from "@/lib/server/reminder-runner";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return runDueReminders(request);
}

export async function POST(request: NextRequest) {
  return runDueReminders(request);
}

async function runDueReminders(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const result = await runDueReminderBatch(limit);

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
      },
      { status: 503 },
    );
  }

  return NextResponse.json(result);
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.REMINDER_RUN_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization") ?? "";
  const headerSecret = request.headers.get("x-reminder-secret") ?? "";
  const querySecret = request.nextUrl.searchParams.get("secret") ?? "";

  return (
    authorization === `Bearer ${secret}` ||
    headerSecret === secret ||
    querySecret === secret
  );
}

function parseLimit(value: string | null) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 25;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), 100);
}
