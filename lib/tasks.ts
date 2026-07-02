import { AnalysisResult, RiskLevel } from "@/lib/types";
import { buildReminderPlan } from "@/lib/reminders";

type TaskInput = Pick<
  AnalysisResult,
  | "appointment_needed"
  | "authority_type"
  | "checklist"
  | "confidence"
  | "consequence_severity"
  | "deadline"
  | "deadline_iso"
  | "deadline_type"
  | "document_type"
  | "extension_possible"
  | "payment_needed"
  | "proof_needed"
  | "reference_number"
  | "reply_needed"
  | "required_action_type"
  | "required_documents"
  | "risk_level"
>;

type PlannedTask = {
  key: string;
  priority: number;
  text: string;
};

const maxActionTasks = 7;
const minActionTasks = 5;
const maxInfoTasks = 3;

export function buildTaskChecklist(input: TaskInput): string[] {
  const tasks: PlannedTask[] = [];
  const isInformational =
    input.document_type === "information_only" ||
    input.required_action_type === "no_action" ||
    input.consequence_severity === "informational";

  addTask(tasks, {
    key: "verify",
    priority: 10,
    text: input.reference_number
      ? `Check the original letter and save reference number ${input.reference_number}`
      : "Check the original letter for the date, reference number, and requested action",
  });

  if (isInformational) {
    addTask(tasks, {
      key: "save-info",
      priority: 20,
      text: "Save the letter for your records",
    });
    addTask(tasks, {
      key: "note-info",
      priority: 30,
      text: "Note the changed information if it affects a future visit or appointment",
    });

    if (input.confidence === "low") {
      addTask(tasks, {
        key: "confidence",
        priority: 15,
        text: "Double-check the original letter because the analysis confidence is low",
      });
    }

    return orderTasks(tasks).slice(0, maxInfoTasks);
  }

  if (hasUsefulDeadline(input.deadline)) {
    const deadlineLabel = getDeadlineLabel(input.deadline, input.deadline_iso);

    addTask(tasks, {
      key: "deadline",
      priority: input.deadline_type === "exclusionary" ? 5 : 12,
      text:
        input.deadline_type === "exclusionary"
          ? `Mark the legal deadline ${deadlineLabel} and act before it expires`
          : `Mark ${deadlineLabel} in your calendar`,
    });
  } else {
    addTask(tasks, {
      key: "deadline-check",
      priority: 18,
      text: "Check whether the letter contains a hidden deadline or appointment date",
    });
  }

  if (input.required_action_type === "file_objection") {
    addTask(tasks, {
      key: "objection-decision",
      priority: 6,
      text: "Decide whether you want to file an objection or appeal",
    });
    addTask(tasks, {
      key: "objection-submit",
      priority: 7,
      text: "Prepare and send the objection before the legal deadline",
    });
  }

  if (input.required_action_type === "pay") {
    addTask(tasks, {
      key: "payment-check",
      priority: 8,
      text: "Verify the amount, payment reference, and bank details",
    });
    addTask(tasks, {
      key: "payment-act",
      priority: 9,
      text: hasUsefulDeadline(input.deadline)
        ? `Pay or request more time before ${getDeadlineLabel(input.deadline, input.deadline_iso)}`
        : "Pay or request more time before enforcement starts",
    });
  } else if (input.payment_needed || input.consequence_severity === "financial_penalty") {
    addTask(tasks, {
      key: "penalty-check",
      priority: 8,
      text: "Check what triggers the fine, fee, or enforcement measure",
    });
  }

  if (input.appointment_needed || input.required_action_type === "attend_appointment") {
    addTask(tasks, {
      key: "appointment-confirm",
      priority: 11,
      text: "Confirm the appointment date, time, and location",
    });
    addTask(tasks, {
      key: "appointment-attend",
      priority: 45,
      text: "Attend the appointment on time",
    });
  }

  if (
    input.required_documents.length > 0 ||
    input.required_action_type === "submit_documents" ||
    input.document_type === "missing_documents"
  ) {
    addTask(tasks, {
      key: "documents-gather",
      priority: 20,
      text: "Gather all requested documents",
    });
    addTask(tasks, {
      key: "documents-proof",
      priority: 28,
      text: "Prepare copies, scans, or digital proof of the documents",
    });
  }

  if (input.required_action_type === "provide_information") {
    addTask(tasks, {
      key: "provide-information",
      priority: 22,
      text: "Provide the requested information to the authority",
    });
  }

  if (input.reply_needed || input.required_action_type === "reply") {
    addTask(tasks, {
      key: "reply",
      priority: 30,
      text: "Review and send the reply draft",
    });
  }

  if (input.extension_possible && input.deadline_type !== "exclusionary") {
    addTask(tasks, {
      key: "extension",
      priority: 34,
      text: "Ask for more time or a new appointment if needed",
    });
  }

  const reminderPlan = buildReminderPlan(input);
  if (reminderPlan.type !== "none") {
    addTask(tasks, {
      key: "reminder",
      priority: 36,
      text: reminderPlan.taskText,
    });
  }

  if (shouldAddEscalationTask(input)) {
    addTask(tasks, {
      key: "escalation",
      priority: 38,
      text: getEscalationTask(input.risk_level),
    });
  }

  if (input.proof_needed || input.risk_level !== "low") {
    addTask(tasks, {
      key: "proof",
      priority: 37,
      text: "Save proof of submission, payment, or reply",
    });
  }

  return fillAndTrimTasks(tasks, input);
}

function fillAndTrimTasks(tasks: PlannedTask[], input: TaskInput) {
  const ordered = orderTasks(tasks);

  if (ordered.length >= minActionTasks) {
    return ordered.slice(0, maxActionTasks);
  }

  const fallbackTasks = input.checklist
    .map((task, index) => ({
      key: `model-${index}`,
      priority: 70 + index,
      text: task,
    }))
    .filter((task) => task.text.trim());

  for (const task of fallbackTasks) {
    addTask(tasks, task);
    if (orderTasks(tasks).length >= minActionTasks) break;
  }

  if (orderTasks(tasks).length < minActionTasks) {
    addTask(tasks, {
      key: "safe-records",
      priority: 80,
      text: "Keep the original letter and all related messages together",
    });
  }

  return orderTasks(tasks).slice(0, maxActionTasks);
}

function addTask(tasks: PlannedTask[], task: PlannedTask) {
  const normalized = normalizeTaskText(task.text);
  if (!normalized) return;

  const duplicate = tasks.some(
    (existing) =>
      existing.key === task.key ||
      normalizeTaskText(existing.text) === normalized ||
      taskSimilarity(existing.text, task.text) > 0.72,
  );

  if (!duplicate) {
    tasks.push({
      ...task,
      text: task.text.trim(),
    });
  }
}

function orderTasks(tasks: PlannedTask[]) {
  return [...tasks]
    .sort((left, right) => left.priority - right.priority)
    .map((task) => task.text);
}

function shouldAddEscalationTask(input: TaskInput) {
  return (
    input.confidence === "low" ||
    input.risk_level === "high" ||
    input.consequence_severity === "financial_penalty" ||
    input.consequence_severity === "status_loss"
  );
}

function getEscalationTask(riskLevel: RiskLevel) {
  if (riskLevel === "high") {
    return "Contact the authority or get qualified help before the deadline";
  }

  return "Contact the authority if any date, amount, or requested document is unclear";
}

function hasUsefulDeadline(deadline: string | null) {
  return Boolean(
    deadline &&
      !/\b(not clearly|no exact|no deadline|keine frist|keine konkrete frist|nicht angegeben)\b/i.test(
        deadline,
      ),
  );
}

function getDeadlineLabel(deadline: string | null, deadlineIso: string | null) {
  if (deadlineIso) {
    const date = new Date(deadlineIso);

    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("en-GB", {
        day: "2-digit",
        hour: deadlineIso.includes("T") ? "2-digit" : undefined,
        minute: deadlineIso.includes("T") ? "2-digit" : undefined,
        month: "2-digit",
        year: "numeric",
      });
    }
  }

  if (!deadline) return "the stated deadline";

  const sentence = deadline.split(/[.!?]/)[0]?.trim() ?? deadline.trim();
  return sentence.length > 48 ? "the stated deadline" : sentence;
}

function normalizeTaskText(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function taskSimilarity(left: string, right: string) {
  const leftWords = new Set(normalizeTaskText(left).split(" ").filter((word) => word.length > 3));
  const rightWords = normalizeTaskText(right).split(" ").filter((word) => word.length > 3);

  if (leftWords.size === 0 || rightWords.length === 0) return 0;

  const matches = rightWords.filter((word) => leftWords.has(word)).length;
  return matches / Math.max(leftWords.size, rightWords.length);
}
