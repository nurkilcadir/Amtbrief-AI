import { NextResponse } from "next/server";
import { markScanRemindersHandled } from "@/lib/server/reminder-store";
import { getCurrentUserId } from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    scanId?: string;
  };

  if (!body.scanId) {
    return NextResponse.json({ error: "scanId is required" }, { status: 400 });
  }

  const userId = await getCurrentUserId();
  const reminders = await markScanRemindersHandled({
    scanId: body.scanId,
    userId,
  });

  return NextResponse.json({
    ok: true,
    reminders: reminders.map((reminder) => ({
      id: reminder.id,
      status: reminder.status,
      updatedAt: reminder.updatedAt,
    })),
  });
}
