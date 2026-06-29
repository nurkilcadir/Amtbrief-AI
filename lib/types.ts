export type RiskLevel = "low" | "medium" | "high";
export type DeadlineType = "exclusionary" | "extendable" | "none";
export type ConsequenceSeverity =
  | "financial_penalty"
  | "status_loss"
  | "rejection"
  | "delay_only"
  | "informational";
export type Confidence = "low" | "medium" | "high";
export type ReplyTone = "neutral" | "polite" | "urgent";
export type ReminderStatus = "none" | "scheduled" | "handled";
export type AnalysisInputType = "text" | "pdf" | "image" | "camera" | "example";

export type AnalysisResult = {
  category: string;
  summary: string;
  source_excerpt: string;
  required_action: string;
  deadline: string | null;
  deadline_iso: string | null;
  deadline_type: DeadlineType;
  consequence_severity: ConsequenceSeverity;
  risk_level: RiskLevel;
  required_documents: string[];
  checklist: string[];
  recommended_next_step: string;
  reply_draft_de: string;
  confidence: Confidence;
};

export type ScanRecord = {
  id: string;
  createdAt: string;
  documentText: string;
  sourceLabel: string;
  inputType: AnalysisInputType;
  analysis: AnalysisResult;
  replyDraft: string;
  replyTone: ReplyTone;
  checklistCompleted: Record<number, boolean>;
  reminderStatus: ReminderStatus;
  reminderUpdatedAt: string | null;
};
