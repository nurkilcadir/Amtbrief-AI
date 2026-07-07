"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  ClipboardCopy,
  Download,
  FileSignature,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DocumentTabs } from "@/components/DocumentTabs";
import {
  CompactDocumentCard,
  DocumentMetaChips,
} from "@/components/DocumentSummaryCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useAmtBrief } from "@/components/AmtBriefProvider";
import { AnalysisResult, ReplyTone } from "@/lib/types";

const tones: { value: ReplyTone; label: string }[] = [
  { value: "neutral", label: "Neutral" },
  { value: "polite", label: "Polite" },
  { value: "urgent", label: "Urgent" },
];

type ClientSignature = {
  createdAt: string;
  downloadUrl: string | null;
  failureReason: string | null;
  fileName: string;
  id: string;
  signedAt: string | null;
  sourceLabel: string;
  status: "failed" | "requested" | "signed";
  updatedAt: string;
};

type SignatureRequestStatus = "error" | "idle" | "loading" | "requesting";

export function ReplyView({ scanId }: { scanId?: string }) {
  const {
    activeScanId,
    analysis,
    replyDraft,
    replyTone,
    replyStatus,
    sourceLabel,
    setReplyDraft,
    setReplyTone,
    generateReply,
    error,
  } = useAmtBrief();
  const realScanId = scanId ?? activeScanId ?? undefined;
  const signatureScanId = analysis
    ? realScanId ?? createSignatureFallbackScanId(analysis, sourceLabel)
    : undefined;
  const [copied, setCopied] = useState(false);
  const [signature, setSignature] = useState<ClientSignature | null>(null);
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const [signatureRequestStatus, setSignatureRequestStatus] =
    useState<SignatureRequestStatus>("idle");

  const refreshSignatureStatus = useCallback(
    async (showLoading = true) => {
      if (!signatureScanId) return;

      if (showLoading) {
        setSignatureRequestStatus("loading");
      }
      setSignatureError(null);

      try {
        const response = await fetch(
          `/api/signatures/status?scanId=${encodeURIComponent(signatureScanId)}`,
        );

        if (!response.ok) {
          throw new Error(
            await getSignatureApiError(
              response,
              "Signature status could not be loaded.",
            ),
          );
        }

        const data = (await response.json()) as {
          signature: ClientSignature | null;
        };
        setSignature(data.signature);
        setSignatureRequestStatus("idle");
      } catch (error) {
        setSignatureError(
          error instanceof Error
            ? error.message
            : "Signature status could not be loaded.",
        );
        setSignatureRequestStatus("error");
      }
    },
    [signatureScanId],
  );

  useEffect(() => {
    if (analysis && !replyDraft && replyStatus === "idle") {
      void generateReply(replyTone);
    }
  }, [analysis, generateReply, replyDraft, replyStatus, replyTone]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshSignatureStatus(false);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [refreshSignatureStatus]);

  // Poll while a signature request is pending so the status (and download
  // link) update automatically once the user signs in the Deutschland App, instead
  // of requiring a manual "Refresh signature status" tap.
  useEffect(() => {
    if (signature?.status !== "requested") return;

    const interval = window.setInterval(() => {
      void refreshSignatureStatus(false);
    }, 4000);

    return () => window.clearInterval(interval);
  }, [signature?.status, refreshSignatureStatus]);

  if (!analysis) {
    return (
      <AppShell title="Reply">
        <section className="app-card p-5">
          <h2 className="text-xl font-semibold text-ink">No reply draft yet</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Analyze a letter first so the reply can reference the right deadline
            and documents.
          </p>
          <div className="mt-5">
            <PrimaryButton href="/input">Analyze a letter</PrimaryButton>
          </div>
        </section>
      </AppShell>
    );
  }

  async function copyDraft() {
    if (!replyDraft) return;
    await navigator.clipboard.writeText(replyDraft);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function changeTone(tone: ReplyTone) {
    setReplyTone(tone);
    void generateReply(tone);
  }

  async function requestSignature() {
    if (!signatureScanId || !analysis || !replyDraft.trim()) return;

    setSignatureRequestStatus("requesting");
    setSignatureError(null);

    try {
      const response = await fetch("/api/signatures/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis,
          replyDraft,
          scanId: signatureScanId,
          sourceLabel,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await getSignatureApiError(
            response,
            "The PDF could not be sent for signature.",
          ),
        );
      }

      const data = (await response.json()) as {
        chatDeepLink: string | null;
        signature: ClientSignature | null;
      };
      setSignature(data.signature);
      setSignatureRequestStatus("idle");
    } catch (error) {
      setSignatureError(
        error instanceof Error
          ? error.message
          : "The PDF could not be sent for signature.",
      );
      setSignatureRequestStatus("error");
    }
  }

  const currentToneLabel =
    tones.find((tone) => tone.value === replyTone)?.label ?? "Polite";
  const signatureBusy =
    signatureRequestStatus === "loading" || signatureRequestStatus === "requesting";
  const canRequestSignature =
    Boolean(signatureScanId && replyDraft.trim()) &&
    replyStatus !== "loading" &&
    !signatureBusy;

  return (
    <AppShell title="Document Summary" eyebrow="AmtBrief AI">
      <div className="space-y-4">
        <CompactDocumentCard analysis={analysis} sourceLabel={sourceLabel} />
        <DocumentTabs scanId={realScanId} />

        <section className="app-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
                Reply draft
              </p>
              <h2 className="mt-1 text-xl font-semibold leading-tight text-ink">
                Ready-to-send reply
              </h2>
            </div>
            <span className="rounded-full bg-mint px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Editable
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Adjust the tone, review names and file numbers, then copy the draft
            before sending.
          </p>

          <div className="mt-4">
            <DocumentMetaChips analysis={analysis} />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
            {tones.map((tone) => (
              <button
                key={tone.value}
                onClick={() => changeTone(tone.value)}
                className={`touch-target rounded-xl px-2 py-2 text-sm font-semibold transition ${
                  replyTone === tone.value
                    ? "bg-white text-civic-700 shadow-sm"
                    : "text-slate-500 active:bg-white/70"
                }`}
              >
                {tone.label}
              </button>
            ))}
          </div>
        </section>

        <section className="app-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Sparkles className="h-4 w-4 text-civic-600" />
                Reply draft
              </div>
              <p className="mt-1 text-xs text-slate-500">{currentToneLabel} tone</p>
            </div>
            <button
              onClick={copyDraft}
              className="touch-target inline-flex shrink-0 items-center gap-2 rounded-xl bg-civic-100 px-3 text-sm font-semibold text-civic-700 active:bg-civic-200"
            >
              {copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {replyStatus === "loading" ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl bg-slate-50 text-slate-500">
              <Loader2 className="mb-3 h-6 w-6 animate-spin text-civic-600" />
              <p className="text-sm font-semibold">Generating reply...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {replyStatus === "error" ? (
                <div className="rounded-xl border border-rose-200 bg-roseSoft p-3 text-sm leading-6 text-rose-800">
                  <div className="mb-1 flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Reply could not be regenerated
                  </div>
                  <p>{error ?? "Please check the letter and try again."}</p>
                </div>
              ) : null}
              <textarea
                value={replyDraft}
                onChange={(event) => setReplyDraft(event.target.value)}
                className="min-h-[320px] w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-[16px] leading-6 text-slate-900 outline-none ring-civic-500/20 transition focus:border-civic-500 focus:bg-white focus:ring-4"
              />
            </div>
          )}

          {signatureScanId ? (
            <div className="mt-4 rounded-2xl border border-civic-200 bg-civic-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-civic-900">
                    <FileSignature className="h-4 w-4 text-civic-700" />
                    Signed PDF
                  </div>
                  <p className="mt-1 text-sm leading-6 text-civic-800">
                    Create an official PDF and send it to Deutschland App for signing.
                  </p>
                </div>
                {signature?.status ? <SignaturePill status={signature.status} /> : null}
              </div>

              {signatureError ? (
                <div className="mt-3 rounded-xl border border-rose-200 bg-roseSoft p-3 text-sm leading-6 text-rose-800">
                  <div className="mb-1 flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Signature flow needs attention
                  </div>
                  <p>{signatureError}</p>
                </div>
              ) : null}

              {signature?.status === "requested" ? (
                <p className="mt-3 text-sm leading-6 text-civic-800">
                  Signature request sent. Sign the PDF in Deutschland App, then refresh
                  this status.
                </p>
              ) : null}

              {signature?.status === "signed" && signature.downloadUrl ? (
                <p className="mt-3 text-sm font-semibold leading-6 text-emerald-800">
                  Signed PDF is ready to download.
                </p>
              ) : null}

              <div className="mt-3 grid gap-3">
                {signature?.status === "signed" && signature.downloadUrl ? (
                  <DownloadPdfButton
                    downloadUrl={signature.downloadUrl}
                    fileName={signature.fileName.replace(".pdf", "-signed.pdf")}
                  />
                ) : (
                  <PrimaryButton
                    onClick={requestSignature}
                    disabled={!canRequestSignature}
                    icon={
                      signatureRequestStatus === "requesting" ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )
                    }
                  >
                    {signatureRequestStatus === "requesting"
                      ? "Sending to Deutschland App"
                      : "Send PDF for signature"}
                  </PrimaryButton>
                )}

                {signature ? (
                  <SecondaryButton
                    onClick={() => void refreshSignatureStatus()}
                    disabled={signatureBusy}
                    icon={
                      signatureRequestStatus === "loading" ? (
                        <Loader2 className="h-5 w-5 animate-spin text-civic-600" />
                      ) : (
                        <RefreshCw className="h-5 w-5 text-civic-600" />
                      )
                    }
                  >
                    Refresh signature status
                  </SecondaryButton>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        <div className="grid gap-3">
          <PrimaryButton
            onClick={copyDraft}
            icon={copied ? <Check className="h-5 w-5" /> : <ClipboardCopy className="h-5 w-5" />}
          >
            {copied ? "Copied draft" : "Copy draft"}
          </PrimaryButton>
          <Link
            href="/reminder"
            className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-[15px] font-semibold text-slate-800 shadow-soft active:scale-[0.99]"
          >
            <Bell className="h-5 w-5 text-civic-600" />
            Continue to reminder
          </Link>
          <SecondaryButton
            onClick={() => void generateReply(replyTone)}
            icon={<RefreshCw className="h-5 w-5 text-civic-600" />}
          >
            Regenerate draft
          </SecondaryButton>
        </div>
      </div>
    </AppShell>
  );
}

function DownloadPdfButton({ downloadUrl, fileName }: { downloadUrl: string; fileName: string }) {
  const [showViewer, setShowViewer] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const viewUrl = `${downloadUrl}${downloadUrl.includes("?") ? "&" : "?"}inline=1`;

  async function handleShare() {
    setSharing(true);
    setShareError(null);
    try {
      const response = await fetch(downloadUrl, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName });
      } else {
        // Fallback: open inline if share not supported
        setShowViewer(true);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setShareError(err.message);
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="space-y-2">
      {!showViewer ? (
        <button
          onClick={() => setShowViewer(true)}
          className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-xl bg-civic-600 px-5 py-3 text-[15px] font-semibold text-white shadow-action transition active:scale-[0.99]"
        >
          <Download className="h-5 w-5" />
          View signed PDF
        </button>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <iframe
            src={viewUrl}
            className="h-[480px] w-full"
            title="Signed PDF"
          />
        </div>
      )}
      <button
        onClick={() => void handleShare()}
        disabled={sharing}
        className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-xl border border-civic-200 bg-white px-5 py-3 text-[15px] font-semibold text-civic-700 shadow-soft transition active:scale-[0.99] disabled:opacity-60"
      >
        {sharing ? <Loader2 className="h-5 w-5 animate-spin text-civic-600" /> : <Download className="h-5 w-5 text-civic-600" />}
        {sharing ? "Preparing…" : "Download / Share PDF"}
      </button>
      {shareError ? (
        <p className="text-xs text-rose-700">{shareError}</p>
      ) : null}
    </div>
  );
}

function SignaturePill({ status }: { status: ClientSignature["status"] }) {
  const className =
    status === "signed"
      ? "bg-mint text-emerald-700"
      : status === "failed"
        ? "bg-roseSoft text-rose-700"
        : "bg-civic-100 text-civic-700";
  const label =
    status === "signed" ? "Signed" : status === "failed" ? "Failed" : "Waiting";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

async function getSignatureApiError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return data?.error ?? fallback;
}

function createSignatureFallbackScanId(
  analysis: AnalysisResult,
  sourceLabel: string,
) {
  const seed = [
    analysis.reference_number,
    analysis.category,
    analysis.deadline,
    sourceLabel,
    analysis.summary,
  ]
    .filter(Boolean)
    .join(":");

  return `reply-${hashForId(seed || "amtbrief-reply")}`;
}

function hashForId(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}
