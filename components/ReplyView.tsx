"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  ClipboardCopy,
  Loader2,
  RefreshCw,
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
import { ReplyTone } from "@/lib/types";

const tones: { value: ReplyTone; label: string }[] = [
  { value: "neutral", label: "Neutral" },
  { value: "polite", label: "Polite" },
  { value: "urgent", label: "Urgent" },
];

export function ReplyView({ scanId }: { scanId?: string }) {
  const {
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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (analysis && !replyDraft && replyStatus === "idle") {
      void generateReply(replyTone);
    }
  }, [analysis, generateReply, replyDraft, replyStatus, replyTone]);

  if (!analysis) {
    return (
      <AppShell title="German reply">
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

  const currentToneLabel =
    tones.find((tone) => tone.value === replyTone)?.label ?? "Polite";

  return (
    <AppShell title="Document Summary" eyebrow="AmtBrief AI">
      <div className="space-y-4">
        <CompactDocumentCard analysis={analysis} sourceLabel={sourceLabel} />
        <DocumentTabs scanId={scanId} />

        <section className="app-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
                Reply draft
              </p>
              <h2 className="mt-1 text-xl font-semibold leading-tight text-ink">
                Ready-to-send German reply
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
                German reply draft
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
