import type { AnalysisResult, ReminderSchedulePoint } from "@/lib/types";

export type ReminderPlanType =
  | "appointment"
  | "high_priority_deadline"
  | "standard_deadline"
  | "routine_deadline"
  | "follow_up"
  | "overdue"
  | "none";

export type ReminderPoint = {
  label: string;
  dateLabel: string;
  scheduledAt: string | null;
  tone: "urgent" | "normal";
};

export type ReminderPlan = {
  type: ReminderPlanType;
  title: string;
  description: string;
  primaryLabel: string;
  confirmationTitle: string;
  confirmationDescription: string;
  taskText: string;
  points: ReminderPoint[];
};

export type ReminderCustomPoint = ReminderSchedulePoint;

export type SchedulableReminderPlan = {
  errors: string[];
  plan: ReminderPlan;
  warnings: string[];
};

type ReminderInput = Pick<
  AnalysisResult,
  | "appointment_needed"
  | "consequence_severity"
  | "deadline"
  | "deadline_iso"
  | "deadline_type"
  | "document_type"
  | "required_action_type"
  | "risk_level"
>;

export function buildSchedulableReminderPlan(
  input: ReminderInput,
  customPoints?: ReminderCustomPoint[],
  now = new Date(),
): SchedulableReminderPlan {
  const defaultPlan = buildReminderPlan(input, now);

  if (!customPoints || customPoints.length === 0) {
    return {
      errors: [],
      plan: defaultPlan,
      warnings: [],
    };
  }

  const { errors, points, warnings } = validateCustomPoints({
    customPoints,
    defaultPlan,
    input,
    now,
  });

  return {
    errors,
    plan:
      errors.length > 0
        ? defaultPlan
        : {
            ...defaultPlan,
            confirmationDescription:
              "Your custom reminder times are saved for this letter and reflected across Home, My Scans, and Tasks.",
            confirmationTitle: "Custom reminders saved",
            description:
              "These custom reminder times will be used instead of the default plan, while keeping deadline safety rules.",
            primaryLabel: "Save custom reminders",
            title: "Custom reminder plan",
            points,
          },
    warnings,
  };
}

export function buildReminderPlan(
  input: ReminderInput,
  now = new Date(),
): ReminderPlan {
  const deadline = parseDeadline(input.deadline_iso);
  const daysUntil = deadline ? getDaysUntil(deadline, now) : null;
  const isAppointment =
    input.appointment_needed ||
    input.required_action_type === "attend_appointment" ||
    input.document_type === "appointment";
  const isNoAction =
    input.required_action_type === "no_action" ||
    input.document_type === "information_only" ||
    input.consequence_severity === "informational";

  if (deadline && daysUntil !== null && daysUntil < 0) {
    return {
      type: "overdue",
      title: "This deadline may have passed",
      description:
        "The safest reminder is an immediate action prompt. Contact the authority and save proof of what you send.",
      primaryLabel: "Save act-today reminder",
      confirmationTitle: "Act-today reminder saved",
      confirmationDescription:
        "This letter is now tracked as urgent across Home, My Scans, and Tasks.",
      taskText: "Contact the authority today about the missed or unclear deadline",
      points: [
        {
          label: "Act today",
          dateLabel: formatDate(now),
          scheduledAt: now.toISOString(),
          tone: "urgent",
        },
      ],
    };
  }

  if (deadline && isAppointment) {
    const points = buildPoints(deadline, now, [
      { offsetDays: 1, label: "1 day before the appointment" },
      { offsetDays: 0, label: "Morning of the appointment" },
    ]);

    return {
      type: "appointment",
      title: "Appointment reminder plan",
      description:
        "For appointments, the useful reminders are close to the date: prepare the day before, then check documents again on the appointment day.",
      primaryLabel: "Save appointment reminders",
      confirmationTitle: "Appointment reminders saved",
      confirmationDescription:
        "The reminder preference is saved for this appointment and reflected across Home, My Scans, and Tasks.",
      taskText: "Set reminders for 1 day before and the morning of the appointment",
      points,
    };
  }

  if (deadline) {
    const highPriority =
      input.risk_level === "high" ||
      input.deadline_type === "exclusionary" ||
      input.consequence_severity === "financial_penalty" ||
      input.consequence_severity === "status_loss";
    const mediumPriority = input.risk_level === "medium" || input.deadline_type === "extendable";
    const offsets = highPriority
      ? [
          { offsetDays: 7, label: "7 days before the deadline" },
          { offsetDays: 3, label: "3 days before the deadline" },
          { offsetDays: 1, label: "1 day before the deadline" },
        ]
      : mediumPriority
        ? [
            { offsetDays: 3, label: "3 days before the deadline" },
            { offsetDays: 1, label: "1 day before the deadline" },
          ]
        : [{ offsetDays: 3, label: "3 days before the deadline" }];
    const points = buildPoints(deadline, now, offsets);

    if (highPriority) {
      return {
        type: "high_priority_deadline",
        title: "High-priority reminder plan",
        description:
          "This letter has a higher-risk deadline. The plan creates earlier prompts so there is time to react, ask questions, or send proof.",
        primaryLabel: "Save high-priority reminders",
        confirmationTitle: "High-priority reminders saved",
        confirmationDescription:
          "The deadline is now tracked with earlier prompts across Home, My Scans, and Tasks.",
        taskText: "Set high-priority reminders for 7, 3, and 1 day before the deadline",
        points,
      };
    }

    if (mediumPriority) {
      return {
        type: "standard_deadline",
        title: "Deadline reminder plan",
        description:
          "This gives you a practical checkpoint a few days before the deadline and one final prompt before it expires.",
        primaryLabel: "Save deadline reminders",
        confirmationTitle: "Deadline reminders saved",
        confirmationDescription:
          "The reminder preference is saved for this letter and reflected across Home, My Scans, and Tasks.",
        taskText: "Set reminders for 3 days and 1 day before the deadline",
        points,
      };
    }

    return {
      type: "routine_deadline",
      title: "Routine reminder plan",
      description:
        "This looks lower risk, so one reminder before the deadline is enough for the current action plan.",
      primaryLabel: "Save routine reminder",
      confirmationTitle: "Routine reminder saved",
      confirmationDescription:
        "The reminder preference is saved for this letter and reflected across Home, My Scans, and Tasks.",
      taskText: "Set a reminder 3 days before the deadline",
      points,
    };
  }

  if (isNoAction) {
    return {
      type: "none",
      title: "No deadline reminder needed",
      description:
        "The letter appears informational. Save it for your records and only follow up if something is unclear.",
      primaryLabel: "Save as noted",
      confirmationTitle: "Marked as noted",
      confirmationDescription:
        "This letter is saved as an informational item across Home, My Scans, and Tasks.",
      taskText: "Save the informational letter for your records",
      points: [
        {
          label: "No dated reminder",
          dateLabel: "No exact deadline",
          scheduledAt: null,
          tone: "normal",
        },
      ],
    };
  }

  return {
    type: "follow_up",
    title: "Follow-up reminder plan",
    description:
      "No exact date was detected. Use a follow-up reminder so the letter does not disappear from your tasks.",
    primaryLabel: "Save follow-up reminder",
    confirmationTitle: "Follow-up reminder saved",
    confirmationDescription:
      "The follow-up preference is saved for this letter and reflected across Home, My Scans, and Tasks.",
    taskText: "Set a follow-up reminder because no exact deadline was detected",
    points: [
      {
        label: "Follow up in 7 days",
        dateLabel: formatDate(addDays(now, 7)),
        scheduledAt: addDays(now, 7).toISOString(),
        tone: "normal",
      },
    ],
  };
}

function buildPoints(
  deadline: Date,
  now: Date,
  offsets: Array<{ offsetDays: number; label: string }>,
): ReminderPoint[] {
  const points = offsets
    .map(({ offsetDays, label }) => {
      const date = addDays(deadline, -offsetDays);
      return {
        label,
        date,
      };
    })
    .filter(({ date }) => !isBeforeToday(date, now))
    .map(({ date, label }) => ({
      label,
      dateLabel: formatDate(date),
      scheduledAt: date.toISOString(),
      tone: isSameDay(date, now) ? "urgent" as const : "normal" as const,
    }));

  if (points.length > 0) {
    return points;
  }

  return [
    {
      label: "Act today",
      dateLabel: formatDate(now),
      scheduledAt: now.toISOString(),
      tone: "urgent",
    },
  ];
}

function validateCustomPoints({
  customPoints,
  defaultPlan,
  input,
  now,
}: {
  customPoints: ReminderCustomPoint[];
  defaultPlan: ReminderPlan;
  input: ReminderInput;
  now: Date;
}) {
  const deadline = parseDeadline(input.deadline_iso);
  const errors: string[] = [];
  const warnings: string[] = [];
  const points: ReminderPoint[] = [];

  if (defaultPlan.type === "none") {
    return {
      errors: ["This informational letter does not need a dated reminder."],
      points,
      warnings,
    };
  }

  for (const [index, point] of customPoints.entries()) {
    const label = point.label.trim() || `Custom reminder ${index + 1}`;

    if (!point.scheduledAt) {
      errors.push(`${label}: choose a date and time.`);
      continue;
    }

    const scheduledAt = parseDeadline(point.scheduledAt);

    if (!scheduledAt) {
      errors.push(`${label}: choose a valid date and time.`);
      continue;
    }

    if (deadline && scheduledAt.getTime() > deadline.getTime()) {
      errors.push(`${label}: reminder must be before the detected deadline.`);
      continue;
    }

    if (scheduledAt.getTime() < now.getTime()) {
      warnings.push(`${label}: this time is in the past and will be sent as soon as the runner executes.`);
    }

    points.push({
      dateLabel: formatDate(scheduledAt),
      label,
      scheduledAt: scheduledAt.toISOString(),
      tone: scheduledAt.getTime() <= now.getTime() || isSameDay(scheduledAt, now)
        ? "urgent"
        : "normal",
    });
  }

  const uniquePoints = dedupePoints(points).sort(
    (left, right) => Date.parse(left.scheduledAt ?? "") - Date.parse(right.scheduledAt ?? ""),
  );

  if (uniquePoints.length === 0) {
    errors.push("Add at least one reminder time.");
  }

  if (deadline && isHighPriority(input)) {
    const safetyThreshold = getSafetyThreshold(deadline, now);
    const hasSafetyPoint = uniquePoints.some(
      (point) =>
        point.scheduledAt !== null &&
        Date.parse(point.scheduledAt) <= safetyThreshold.getTime(),
    );

    if (!hasSafetyPoint) {
      errors.push(
        `High-risk letters need at least one reminder by ${formatDate(safetyThreshold)}.`,
      );
    }
  }

  return {
    errors: [...new Set(errors)],
    points: uniquePoints,
    warnings: [...new Set(warnings)],
  };
}

function dedupePoints(points: ReminderPoint[]) {
  const seen = new Set<string>();

  return points.filter((point) => {
    const key = `${point.label}:${point.scheduledAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isHighPriority(input: ReminderInput) {
  return (
    input.risk_level === "high" ||
    input.deadline_type === "exclusionary" ||
    input.consequence_severity === "financial_penalty" ||
    input.consequence_severity === "status_loss"
  );
}

function getSafetyThreshold(deadline: Date, now: Date) {
  const oneDayBeforeDeadline = addDays(deadline, -1);

  if (oneDayBeforeDeadline.getTime() < now.getTime()) {
    return deadline;
  }

  return oneDayBeforeDeadline;
}

function parseDeadline(deadlineIso: string | null) {
  if (!deadlineIso) return null;

  const date = new Date(deadlineIso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDaysUntil(deadline: Date, now: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(deadline).getTime() - startOfDay(now).getTime()) / msPerDay);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isBeforeToday(date: Date, now: Date) {
  return startOfDay(date).getTime() < startOfDay(now).getTime();
}

function isSameDay(left: Date, right: Date) {
  return startOfDay(left).getTime() === startOfDay(right).getTime();
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDate(date: Date) {
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    hour: hasTime ? "2-digit" : undefined,
    minute: hasTime ? "2-digit" : undefined,
    month: "2-digit",
    year: "numeric",
  });
}
