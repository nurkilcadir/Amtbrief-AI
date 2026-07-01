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
export type ReminderSchedulePoint = {
  label: string;
  scheduledAt: string | null;
};
export type AnalysisInputType = "text" | "pdf" | "image" | "camera" | "example";
export type AuthorityType =
  | "auslaenderbehoerde"
  | "finanzamt"
  | "jobcenter"
  | "krankenkasse"
  | "buergeramt"
  | "university_bafog"
  | "insurance"
  | "vehicle_registration"
  | "other";
export type DocumentType =
  | "appointment"
  | "missing_documents"
  | "payment_request"
  | "objection_deadline"
  | "hearing"
  | "decision_notice"
  | "information_only"
  | "application_status"
  | "other";
export type RequiredActionType =
  | "attend_appointment"
  | "submit_documents"
  | "pay"
  | "reply"
  | "file_objection"
  | "provide_information"
  | "no_action"
  | "other";

export type AnalysisResult = {
  category: string;
  summary: string;
  source_excerpt: string;
  authority_type: AuthorityType;
  document_type: DocumentType;
  required_action_type: RequiredActionType;
  required_action: string;
  deadline: string | null;
  deadline_iso: string | null;
  deadline_evidence: string | null;
  deadline_type: DeadlineType;
  consequence_severity: ConsequenceSeverity;
  reply_needed: boolean;
  appointment_needed: boolean;
  payment_needed: boolean;
  payment_amount: string | null;
  payment_iban: string | null;
  proof_needed: boolean;
  extension_possible: boolean;
  reference_number: string | null;
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
  reminderCustomPoints: ReminderSchedulePoint[] | null;
  reminderStatus: ReminderStatus;
  reminderUpdatedAt: string | null;
};
