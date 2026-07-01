import { NextResponse } from "next/server";
import { scheduleReminders } from "@/lib/server/reminder-store";
import { getCurrentUserId } from "@/lib/server/session";
import type { ReminderCustomPoint } from "@/lib/reminders";
import type { AnalysisResult } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    analysis?: AnalysisResult;
    customPoints?: ReminderCustomPoint[];
    scanId?: string;
    sourceLabel?: string;
  };

  if (!body.scanId || !body.analysis) {
    return NextResponse.json(
      { error: "scanId and analysis are required" },
      { status: 400 },
    );
  }

  const userId = await getCurrentUserId();
  const result = await scheduleReminders({
    analysis: body.analysis,
    customPoints: Array.isArray(body.customPoints) ? body.customPoints : undefined,
    scanId: body.scanId,
    sourceLabel: body.sourceLabel ?? "Official letter",
    userId,
  });

  if (result.errors.length > 0) {
    return NextResponse.json(
      {
        errors: result.errors,
        ok: false,
        warnings: result.warnings,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    plan: {
      type: result.plan.type,
      title: result.plan.title,
    },
    reminders: result.reminders.map((reminder) => ({
      dateLabel: reminder.dateLabel,
      id: reminder.id,
      label: reminder.label,
      scheduledAt: reminder.scheduledAt,
      status: reminder.status,
    })),
    warnings: result.warnings,
  });
}
