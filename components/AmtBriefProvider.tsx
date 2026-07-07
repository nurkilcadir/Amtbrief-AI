"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getSampleLetterById, sampleLetter } from "@/lib/sample-documents";
import { rememberLocalChecklistOpenIntent } from "@/lib/client-open-intent";
import { notifyAnalysisReady } from "@/lib/native-notifications";
import { normalizeAnalysis } from "@/lib/mock-ai";
import type { ReminderCustomPoint } from "@/lib/reminders";
import {
  AnalysisResult,
  AnalysisInputType,
  ReminderStatus,
  ReplyTone,
  ScanRecord,
} from "@/lib/types";

type AnalysisStatus = "idle" | "loading" | "ready" | "error";
type ReplyStatus = "idle" | "loading" | "ready" | "error";

type AmtBriefState = {
  documentText: string;
  documentFile: File | null;
  documentInputType: AnalysisInputType | null;
  sourceLabel: string;
  analysis: AnalysisResult | null;
  activeScanId: string | null;
  scanHistory: ScanRecord[];
  analysisStatus: AnalysisStatus;
  replyDraft: string;
  replyTone: ReplyTone;
  replyStatus: ReplyStatus;
  checklistCompleted: Record<number, boolean>;
  reminderCustomPoints: ReminderCustomPoint[] | null;
  reminderStatus: ReminderStatus;
  reminderUpdatedAt: string | null;
  error: string | null;
};

type AmtBriefContextValue = AmtBriefState & {
  isHydrated: boolean;
  setDocument: (
    text: string,
    sourceLabel?: string,
    inputType?: AnalysisInputType,
  ) => void;
  setDocumentFile: (
    file: File,
    sourceLabel: string,
    inputType: Extract<AnalysisInputType, "pdf" | "image" | "camera">,
  ) => void;
  loadSampleDocument: (sampleId?: string) => void;
  analyzeCurrentDocument: () => Promise<void>;
  selectScan: (scanId: string) => void;
  toggleChecklistItem: (index: number) => void;
  toggleScanChecklistItem: (scanId: string, index: number) => void;
  setReplyDraft: (draft: string) => void;
  setReplyTone: (tone: ReplyTone) => void;
  generateReply: (tone?: ReplyTone) => Promise<void>;
  setReminderStatus: (
    status: ReminderStatus,
    customPoints?: ReminderCustomPoint[],
  ) => Promise<void>;
  resetFlow: () => void;
};

const storageKey = "amtbrief-ai-session-v1";

const initialState: AmtBriefState = {
  documentText: "",
  documentFile: null,
  documentInputType: null,
  sourceLabel: "",
  analysis: null,
  activeScanId: null,
  scanHistory: [],
  analysisStatus: "idle",
  replyDraft: "",
  replyTone: "polite",
  replyStatus: "idle",
  checklistCompleted: {},
  reminderCustomPoints: null,
  reminderStatus: "none",
  reminderUpdatedAt: null,
  error: null,
};

type PersistedAmtBriefState = {
  version: 4;
  activeScanId: string | null;
  scanHistory: ScanRecord[];
};

const AmtBriefContext = createContext<AmtBriefContextValue | null>(null);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function AmtBriefProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AmtBriefState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        setState(hydrateStoredState(JSON.parse(raw)));
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(toPersistedState(state)));
  }, [hydrated, state]);

  const setDocument = useCallback(
    (
      text: string,
      sourceLabel = "Pasted letter",
      inputType: AnalysisInputType = "text",
    ) => {
      setState((current) => ({
        ...current,
        documentText: text,
        documentFile: null,
        documentInputType: inputType,
        sourceLabel,
        analysis: null,
        activeScanId: null,
        analysisStatus: "idle",
        replyDraft: "",
        replyStatus: "idle",
        checklistCompleted: {},
        reminderCustomPoints: null,
        reminderStatus: "none",
        reminderUpdatedAt: null,
        error: null,
      }));
    },
    [],
  );

  const setDocumentFile = useCallback(
    (
      file: File,
      sourceLabel: string,
      inputType: Extract<AnalysisInputType, "pdf" | "image" | "camera">,
    ) => {
      setState((current) => ({
        ...current,
        documentText: "",
        documentFile: file,
        documentInputType: inputType,
        sourceLabel,
        analysis: null,
        activeScanId: null,
        analysisStatus: "idle",
        replyDraft: "",
        replyStatus: "idle",
        checklistCompleted: {},
        reminderCustomPoints: null,
        reminderStatus: "none",
        reminderUpdatedAt: null,
        error: null,
      }));
    },
    [],
  );

  const loadSampleDocument = useCallback(
    (sampleId?: string) => {
      const sample = (sampleId && getSampleLetterById(sampleId)) || sampleLetter;
      setDocument(sample.text, sample.title, "example");
    },
    [setDocument],
  );

  const analyzeCurrentDocument = useCallback(async () => {
    const text = state.documentText.trim();
    const file = state.documentFile;
    const inputType = state.documentInputType ?? "text";

    if (!text && !file) {
      setState((current) => ({
        ...current,
        analysisStatus: "error",
        error: "Paste a letter, upload a document, or choose a typical letter situation first.",
      }));
      return;
    }

    setState((current) => ({
      ...current,
      analysisStatus: "loading",
      error: null,
    }));

    const startedAt = Date.now();

    try {
      const response = file
        ? await fetch("/api/analyze", {
            method: "POST",
            body: createAnalyzeFormData({
              file,
              inputType,
              sourceLabel: state.sourceLabel,
            }),
          })
        : await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ letterText: text, inputType }),
          });

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            "The analysis could not be created. Please try again.",
          ),
        );
      }

      const analysis = (await response.json()) as AnalysisResult;
      const remaining = Math.max(0, 2000 - (Date.now() - startedAt));
      await delay(remaining);
      const createdAt = new Date().toISOString();
      const scan: ScanRecord = {
        id: createScanId(),
        createdAt,
        documentText: getStoredDocumentText({
          analysis,
          inputType,
          sourceLabel: state.sourceLabel,
          text,
        }),
        sourceLabel: state.sourceLabel || "Official letter",
        inputType,
        analysis,
        replyDraft: analysis.reply_draft_de,
        replyTone: state.replyTone,
        checklistCompleted: {},
        reminderCustomPoints: null,
        reminderStatus: "none",
        reminderUpdatedAt: null,
      };

      setState((current) => ({
        ...current,
        documentText: scan.documentText,
        documentFile: null,
        documentInputType: scan.inputType,
        sourceLabel: scan.sourceLabel,
        analysis,
        activeScanId: scan.id,
        scanHistory: upsertScan(current.scanHistory, scan),
        analysisStatus: "ready",
        replyDraft: analysis.reply_draft_de,
        replyStatus: "ready",
        checklistCompleted: {},
        reminderCustomPoints: null,
        reminderStatus: "none",
        reminderUpdatedAt: null,
        error: null,
      }));

      // SuperApp MiniApp → mPower chat summary. Native app → local notification.
      void syncChecklistChatSummary(scan);
      void notifyAnalysisReady({
        scanId: scan.id,
        title: scan.sourceLabel || scan.analysis.category || "Official letter",
        openCount: scan.analysis.checklist.length,
      });
    } catch (error) {
      const remaining = Math.max(0, 2000 - (Date.now() - startedAt));
      await delay(remaining);
      setState((current) => ({
        ...current,
        analysisStatus: "error",
        error:
          error instanceof Error && error.message
            ? error.message
            : "The analysis could not be created. Please try again.",
      }));
    }
  }, [
    state.documentInputType,
    state.documentFile,
    state.documentText,
    state.replyTone,
    state.sourceLabel,
  ]);

  const selectScan = useCallback((scanId: string) => {
    setState((current) => {
      const scan = current.scanHistory.find((item) => item.id === scanId);
      if (!scan) return current;

      return activeFieldsFromScan(current, scan);
    });
  }, []);

  const toggleChecklistItem = useCallback((index: number) => {
    setState((current) => ({
      ...current,
      checklistCompleted: {
        ...current.checklistCompleted,
        [index]: !current.checklistCompleted[index],
      },
      scanHistory: current.activeScanId
        ? current.scanHistory.map((scan) =>
            scan.id === current.activeScanId
              ? {
                  ...scan,
                  checklistCompleted: {
                    ...scan.checklistCompleted,
                    [index]: !scan.checklistCompleted[index],
                  },
                }
              : scan,
          )
        : current.scanHistory,
    }));
  }, []);

  const toggleScanChecklistItem = useCallback((scanId: string, index: number) => {
    setState((current) => {
      const nextHistory = current.scanHistory.map((scan) =>
        scan.id === scanId
          ? {
              ...scan,
              checklistCompleted: {
                ...scan.checklistCompleted,
                [index]: !scan.checklistCompleted[index],
              },
            }
          : scan,
      );
      const selected = nextHistory.find((scan) => scan.id === current.activeScanId);

      return selected
        ? activeFieldsFromScan({ ...current, scanHistory: nextHistory }, selected)
        : { ...current, scanHistory: nextHistory };
    });
  }, []);

  const setReplyDraft = useCallback((draft: string) => {
    setState((current) => ({
      ...current,
      replyDraft: draft,
      scanHistory: current.activeScanId
        ? current.scanHistory.map((scan) =>
            scan.id === current.activeScanId ? { ...scan, replyDraft: draft } : scan,
          )
        : current.scanHistory,
    }));
  }, []);

  const setReplyTone = useCallback((tone: ReplyTone) => {
    setState((current) => ({
      ...current,
      replyTone: tone,
      scanHistory: current.activeScanId
        ? current.scanHistory.map((scan) =>
            scan.id === current.activeScanId ? { ...scan, replyTone: tone } : scan,
          )
        : current.scanHistory,
    }));
  }, []);

  const generateReply = useCallback(
    async (tone = state.replyTone) => {
      if (!state.analysis) return;

      setState((current) => ({
        ...current,
        replyTone: tone,
        replyStatus: "loading",
        error: null,
      }));

      try {
        const response = await fetch("/api/generate-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analysis: state.analysis, tone }),
        });

        if (!response.ok) {
          throw new Error(
            await getApiErrorMessage(
              response,
              "The reply draft could not be generated. Please try again.",
            ),
          );
        }

        const data = (await response.json()) as { reply_draft_de: string };
        setState((current) => ({
          ...current,
          replyDraft: data.reply_draft_de,
          replyStatus: "ready",
          scanHistory: current.activeScanId
            ? current.scanHistory.map((scan) =>
                scan.id === current.activeScanId
                  ? {
                      ...scan,
                      replyDraft: data.reply_draft_de,
                      replyTone: tone,
                    }
                  : scan,
              )
            : current.scanHistory,
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          replyStatus: "error",
          error:
            error instanceof Error && error.message
              ? error.message
              : "The reply draft could not be generated. Please try again.",
        }));
      }
    },
    [state.analysis, state.replyTone],
  );

  const setReminderStatus = useCallback(async (
    status: ReminderStatus,
    customPoints?: ReminderCustomPoint[],
  ) => {
    const activeScan = state.activeScanId
      ? state.scanHistory.find((scan) => scan.id === state.activeScanId) ?? null
      : null;

    if (activeScan) {
      await syncServerReminderStatus(
        status,
        activeScan,
        customPoints ?? activeScan.reminderCustomPoints ?? undefined,
      );
    }

    setState((current) => {
      const updatedAt = new Date().toISOString();
      const shouldCompleteAll = status === "handled" && current.analysis;
      const nextCustomPoints =
        status === "scheduled"
          ? customPoints ?? current.reminderCustomPoints
          : current.reminderCustomPoints;
      const completedChecklist = shouldCompleteAll
        ? Object.fromEntries(
            current.analysis!.checklist.map((_, index) => [index, true]),
          )
        : current.checklistCompleted;
      const nextHistory = current.activeScanId
        ? current.scanHistory.map((scan) =>
            scan.id === current.activeScanId
              ? {
                  ...scan,
                  checklistCompleted:
                    status === "handled"
                      ? Object.fromEntries(
                          scan.analysis.checklist.map((_, index) => [index, true]),
                        )
                      : scan.checklistCompleted,
                  reminderCustomPoints:
                    status === "scheduled"
                      ? customPoints ?? scan.reminderCustomPoints
                      : scan.reminderCustomPoints,
                  reminderStatus: status,
                  reminderUpdatedAt: updatedAt,
                }
              : scan,
          )
        : current.scanHistory;

      return {
        ...current,
        checklistCompleted: completedChecklist,
        reminderCustomPoints: nextCustomPoints,
        scanHistory: nextHistory,
        reminderStatus: status,
        reminderUpdatedAt: updatedAt,
      };
    });
  }, [state.activeScanId, state.scanHistory]);

  const resetFlow = useCallback(() => {
    setState(initialState);
    window.localStorage.removeItem(storageKey);
  }, []);

  const value = useMemo<AmtBriefContextValue>(
    () => ({
      ...state,
      isHydrated: hydrated,
      setDocument,
      setDocumentFile,
      loadSampleDocument,
      analyzeCurrentDocument,
      selectScan,
      toggleChecklistItem,
      toggleScanChecklistItem,
      setReplyDraft,
      setReplyTone,
      generateReply,
      setReminderStatus,
      resetFlow,
    }),
    [
      state,
      hydrated,
      setDocument,
      setDocumentFile,
      loadSampleDocument,
      analyzeCurrentDocument,
      selectScan,
      toggleChecklistItem,
      toggleScanChecklistItem,
      setReplyDraft,
      setReplyTone,
      generateReply,
      setReminderStatus,
      resetFlow,
    ],
  );

  if (!hydrated) {
    return <SessionRestoreScreen />;
  }

  return <AmtBriefContext.Provider value={value}>{children}</AmtBriefContext.Provider>;
}

export function useAmtBrief() {
  const context = useContext(AmtBriefContext);
  if (!context) {
    throw new Error("useAmtBrief must be used within AmtBriefProvider");
  }
  return context;
}

function SessionRestoreScreen() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[430px] flex-col bg-civic-50 px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+24px)]">
      <div className="flex flex-1 flex-col justify-center">
        <div className="app-card p-5">
          <div className="mb-5 h-12 w-12 animate-pulse rounded-xl bg-civic-100" />
          <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-slate-100" />
          <div className="mt-2 h-4 w-3/4 animate-pulse rounded-full bg-slate-100" />
        </div>
      </div>
    </main>
  );
}

function hydrateStoredState(value: unknown): AmtBriefState {
  if (!value || typeof value !== "object") {
    return initialState;
  }

  const stored = value as Partial<AmtBriefState & PersistedAmtBriefState>;
  const migratedHistory = Array.isArray(stored.scanHistory)
    ? stored.scanHistory.filter(isScanRecord).map(normalizeScanRecord)
    : [];
  const migratedFromLegacy =
    migratedHistory.length === 0 && stored.analysis
      ? [
          {
            id: createScanId(),
            createdAt: new Date().toISOString(),
            documentText: stored.documentText ?? "",
            sourceLabel: stored.sourceLabel ?? "Official letter",
            inputType: isAnalysisInputType(stored.documentInputType)
              ? stored.documentInputType
              : "text",
            analysis: stored.analysis,
            replyDraft: stored.replyDraft ?? stored.analysis.reply_draft_de,
            replyTone: stored.replyTone ?? "polite",
            checklistCompleted: stored.checklistCompleted ?? {},
            reminderCustomPoints: null,
            reminderStatus: stored.reminderStatus ?? "none",
            reminderUpdatedAt: stored.reminderUpdatedAt ?? null,
          },
        ]
      : migratedHistory;
  const activeScan =
    migratedFromLegacy.find((scan) => scan.id === stored.activeScanId) ??
    migratedFromLegacy[0];

  if (!activeScan) {
    return {
      ...initialState,
      sourceLabel: stored.sourceLabel ?? "",
      scanHistory: migratedFromLegacy,
    };
  }

  return activeFieldsFromScan(
    {
      ...initialState,
      scanHistory: migratedFromLegacy,
    },
    activeScan,
  );
}

function activeFieldsFromScan(state: AmtBriefState, scan: ScanRecord): AmtBriefState {
  return {
    ...state,
    documentText: scan.documentText,
    documentFile: null,
    documentInputType: scan.inputType,
    sourceLabel: scan.sourceLabel,
    analysis: scan.analysis,
    activeScanId: scan.id,
    analysisStatus: "idle",
    replyDraft: scan.replyDraft,
    replyTone: scan.replyTone,
    replyStatus: "ready",
    checklistCompleted: scan.checklistCompleted,
    reminderCustomPoints: scan.reminderCustomPoints ?? null,
    reminderStatus: scan.reminderStatus,
    reminderUpdatedAt: scan.reminderUpdatedAt,
    error: null,
  };
}

function upsertScan(history: ScanRecord[], scan: ScanRecord) {
  return [scan, ...history.filter((item) => item.id !== scan.id)].slice(0, 25);
}

function isScanRecord(value: unknown): value is ScanRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<ScanRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.sourceLabel === "string" &&
    Boolean(record.analysis)
  );
}

function normalizeScanRecord(scan: ScanRecord): ScanRecord {
  const analysis = normalizeAnalysis(scan.analysis, scan.documentText || scan.sourceLabel);

  return {
    ...scan,
    documentText: scan.documentText ?? "",
    inputType: isAnalysisInputType(scan.inputType) ? scan.inputType : "text",
    analysis,
    replyDraft: scan.replyDraft ?? analysis.reply_draft_de,
    replyTone: scan.replyTone ?? "polite",
    checklistCompleted: scan.checklistCompleted ?? {},
    reminderCustomPoints: Array.isArray(scan.reminderCustomPoints)
      ? scan.reminderCustomPoints.filter(isReminderCustomPoint)
      : null,
    reminderStatus:
      scan.reminderStatus === "scheduled" || scan.reminderStatus === "handled"
        ? scan.reminderStatus
        : "none",
    reminderUpdatedAt: scan.reminderUpdatedAt ?? null,
  };
}

function toPersistedState(state: AmtBriefState): PersistedAmtBriefState {
  return {
    version: 4,
    activeScanId: state.activeScanId,
    scanHistory: state.scanHistory.map(normalizeScanRecord),
  };
}

function isReminderCustomPoint(value: unknown): value is ReminderCustomPoint {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<ReminderCustomPoint>;
  return (
    typeof record.label === "string" &&
    (typeof record.scheduledAt === "string" || record.scheduledAt === null)
  );
}

function isAnalysisInputType(value: unknown): value is AnalysisInputType {
  return (
    value === "text" ||
    value === "pdf" ||
    value === "image" ||
    value === "camera" ||
    value === "example"
  );
}

function createAnalyzeFormData({
  file,
  inputType,
  sourceLabel,
}: {
  file: File;
  inputType: AnalysisInputType;
  sourceLabel: string;
}) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("inputType", inputType);
  formData.set("sourceLabel", sourceLabel);
  return formData;
}

async function getApiErrorMessage(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: unknown };
    return typeof data.error === "string" && data.error.trim()
      ? data.error
      : fallback;
  } catch {
    return fallback;
  }
}

function getStoredDocumentText({
  analysis,
  inputType,
  sourceLabel,
  text,
}: {
  analysis: AnalysisResult;
  inputType: AnalysisInputType;
  sourceLabel: string;
  text: string;
}) {
  if (text) {
    return text;
  }

  if (analysis.source_excerpt) {
    return analysis.source_excerpt;
  }

  if (inputType === "pdf") {
    return `Uploaded PDF document: ${sourceLabel || "Official letter"}`;
  }

  if (inputType === "camera") {
    return `Camera photo document: ${sourceLabel || "Official letter"}`;
  }

  if (inputType === "image") {
    return `Uploaded image document: ${sourceLabel || "Official letter"}`;
  }

  return sourceLabel || "Official letter";
}

function createScanId() {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function syncServerReminderStatus(
  status: ReminderStatus,
  scan: ScanRecord,
  customPoints?: ReminderCustomPoint[],
) {
  if (status === "scheduled") {
    const response = await fetch("/api/reminders/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysis: scan.analysis,
        customPoints,
        scanId: scan.id,
        sourceLabel: scan.sourceLabel,
      }),
    });

    await assertReminderResponse(response, "Reminder could not be saved.");
    return;
  }

  if (status === "handled") {
    const response = await fetch("/api/reminders/handled", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scanId: scan.id,
      }),
    });

    await assertReminderResponse(response, "Handled status could not be saved.");
  }
}

async function syncChecklistChatSummary(scan: ScanRecord) {
  try {
    const response = await fetch("/api/chat/checklist-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysis: scan.analysis,
        documentText: scan.documentText,
        scanId: scan.id,
        sourceLabel: scan.sourceLabel,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      console.warn(
        `AmtBrief: checklist chat summary was not sent${
          payload?.error ? `: ${payload.error}` : ""
        }`,
      );
      return;
    }

    rememberLocalChecklistOpenIntent(scan.id);
  } catch (error) {
    console.warn("AmtBrief: checklist chat summary request failed", error);
  }
}

async function assertReminderResponse(response: Response, fallbackMessage: string) {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; errors?: string[]; ok?: boolean }
    | null;

  if (response.ok && payload?.ok !== false) {
    return;
  }

  const message =
    payload?.errors?.join(" ") ||
    payload?.error ||
    `${fallbackMessage} Please try again.`;

  throw new Error(message);
}
