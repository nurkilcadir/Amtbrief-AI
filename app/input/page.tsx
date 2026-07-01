"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ClipboardType,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAmtBrief } from "@/components/AmtBriefProvider";
import { useLang } from "@/components/LanguageProvider";
import { AnalysisInputType } from "@/lib/types";
import { findSampleLetterByText, sampleLetters } from "@/lib/sample-documents";
import type { T } from "@/lib/i18n";

type FileInputType = Extract<AnalysisInputType, "pdf" | "image" | "camera">;

const maxPdfSize = 15 * 1024 * 1024;
const maxImageSize = 8 * 1024 * 1024;

export default function InputPage() {
  const router = useRouter();
  const { t } = useLang();
  const { documentText, setDocument, setDocumentFile } = useAmtBrief();
  const [text, setText] = useState(documentText);
  const [file, setFile] = useState<File | null>(null);
  const [fileInputType, setFileInputType] = useState<FileInputType | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [textMode, setTextMode] = useState(Boolean(documentText));
  const [error, setError] = useState("");
  const [samplesOpen, setSamplesOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef("");
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && documentText) {
      setText(documentText);
      initialized.current = true;
    }
  }, [documentText]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function updatePreviewUrl(nextUrl: string) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>, inputType: FileInputType) {
    const nextFile = event.target.files?.[0] ?? null;
    event.target.value = "";
    setError("");
    if (!nextFile) return;

    const validationError = validateFile(nextFile, inputType, t.input);
    if (validationError) {
      setFile(null);
      setFileInputType(null);
      updatePreviewUrl("");
      setError(validationError);
      return;
    }

    updatePreviewUrl(inputType === "pdf" ? "" : URL.createObjectURL(nextFile));
    setFile(nextFile);
    setFileInputType(inputType);
    setTextMode(false);
  }

  function applySample(sampleText: string) {
    setText(sampleText);
    setFile(null);
    setFileInputType(null);
    updatePreviewUrl("");
    setError("");
    setTextMode(true);
    setSamplesOpen(false);
  }

  function clearFile() {
    setFile(null);
    setFileInputType(null);
    updatePreviewUrl("");
    setError("");
  }

  function clearText() {
    setText("");
    setError("");
  }

  function changeSelectedFile() {
    if (fileInputType === "pdf") { pdfInputRef.current?.click(); return; }
    if (fileInputType === "camera") { cameraInputRef.current?.click(); return; }
    imageInputRef.current?.click();
  }

  function analyze() {
    if (file && fileInputType) {
      setDocumentFile(file, file.name || getFileSourceLabel(fileInputType, t.input), fileInputType);
      router.push("/analysis");
      return;
    }

    if (text.trim().length < 80) {
      setError(t.input.minCharsError);
      return;
    }

    const matchedSample = findSampleLetterByText(text);
    const label = matchedSample ? matchedSample.title : "Eingefügter Brief";
    const inputType: AnalysisInputType = matchedSample ? "example" : "text";
    setDocument(text, label, inputType);
    router.push("/analysis");
  }

  const canAnalyze = Boolean(file) || text.trim().length >= 80;
  const trimmedLength = text.trim().length;
  const textReady = trimmedLength >= 80;
  const analyzeLabel = file
    ? t.input.analyzeBtn(getFileTypeLabel(fileInputType ?? "image", t.input))
    : t.input.analyzeBtnDefault;
  const stickyAnalyzeLabel = analyzeLabel.replace(/\s*→$/, "");
  const stickyHelper = getAnalyzeHelper({
    canAnalyze,
    fileInputType,
    hasFile: Boolean(file),
    textLength: trimmedLength,
    textMode,
  });

  return (
    <AppShell title={t.input.pageTitle} eyebrow="AmtBrief AI">
      <div className="space-y-4 pb-28">
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleFile(e, "camera")} aria-hidden="true" tabIndex={-1} className="hidden" />
        <input ref={pdfInputRef} type="file" accept="application/pdf" onChange={(e) => handleFile(e, "pdf")} aria-hidden="true" tabIndex={-1} className="hidden" />
        <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => handleFile(e, "image")} aria-hidden="true" tabIndex={-1} className="hidden" />

        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className={`touch-target flex w-full items-center gap-4 rounded-[20px] bg-civic-600 px-5 py-5 text-left text-white shadow-action active:scale-[0.99] ${fileInputType === "camera" ? "ring-4 ring-civic-200" : ""}`}
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-civic-700">
            <Camera className="h-7 w-7" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold">{t.input.cameraBtn}</span>
            <span className="mt-1 block text-xs font-medium leading-5 text-civic-100">{t.input.cameraSub}</span>
          </span>
        </button>

        <section className="grid grid-cols-3 gap-2">
          <InputOption active={fileInputType === "pdf"} icon={<UploadCloud className="h-5 w-5" />} title={t.input.uploadPdf} text={t.input.uploadPdfSub} onClick={() => pdfInputRef.current?.click()} />
          <InputOption active={fileInputType === "image"} icon={<ImageIcon className="h-5 w-5" />} title={t.input.uploadImage} text={t.input.uploadImageSub} onClick={() => imageInputRef.current?.click()} />
          <InputOption
            active={textMode}
            icon={<ClipboardType className="h-5 w-5" />}
            title={t.input.pasteText}
            text={t.input.pasteTextSub}
            onClick={() => { setTextMode(true); setFile(null); setFileInputType(null); updatePreviewUrl(""); setError(""); }}
          />
        </section>

        {file ? (
          <SelectedFileCard
            file={file}
            inputType={fileInputType ?? "image"}
            previewUrl={previewUrl}
            tipsOpen={tipsOpen}
            onToggleTips={() => setTipsOpen((v) => !v)}
            onChange={changeSelectedFile}
            onUploadImage={() => imageInputRef.current?.click()}
            onRemove={clearFile}
            ti={t.input}
          />
        ) : null}

        {textMode ? (
          <section className="app-card p-4">
            <label htmlFor="letter" className="text-sm font-semibold text-slate-700">{t.input.textLabel}</label>
            <textarea
              id="letter"
              value={text}
              onChange={(e) => { setText(e.target.value); setError(""); }}
              placeholder={t.input.textPlaceholder}
              className="mt-2 min-h-[244px] w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-[16px] leading-6 text-slate-900 outline-none ring-civic-500/20 transition focus:border-civic-500 focus:bg-white focus:ring-4"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${textReady ? "bg-mint text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {textReady ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                {t.input.charCount(trimmedLength)}
              </div>
              {text ? (
                <button type="button" onClick={clearText} className="touch-target inline-flex items-center justify-center rounded-lg px-2 text-xs font-semibold text-slate-500 active:bg-slate-100">
                  {t.input.clearBtn}
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {error ? (
          <section className="rounded-[16px] border border-rose-200 bg-roseSoft p-3 text-sm leading-5 text-rose-800">{error}</section>
        ) : null}

        <section className="app-card overflow-hidden">
          <button type="button" onClick={() => setSamplesOpen((v) => !v)} className="touch-target flex w-full items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Sparkles className="h-4 w-4 text-civic-600" />
              {t.input.samplesTitle}
            </div>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${samplesOpen ? "rotate-180" : ""}`} />
          </button>
          {samplesOpen ? (
            <div className="px-4 pb-4">
              <p className="mb-3 text-xs leading-5 text-slate-500">{t.input.samplesSub}</p>
              <div className="space-y-2">
                {sampleLetters.map((sample) => (
                  <button key={sample.id} type="button" onClick={() => applySample(sample.text)} className="touch-target flex w-full flex-col items-start gap-1 rounded-2xl border border-slate-200 bg-white p-3 text-left transition active:scale-[0.99] active:bg-slate-50">
                    <span className="text-sm font-semibold text-ink">{sample.title}</span>
                    <span className="inline-flex min-h-[24px] items-center rounded-full bg-civic-100 px-2.5 text-[11px] font-bold text-civic-700">{sample.tag}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

      </div>
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+82px)] left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 px-5">
        <div className="rounded-[20px] border border-slate-200/90 bg-white/95 p-3 shadow-[0_-10px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <p className={`mb-2 text-center text-xs font-semibold leading-5 ${canAnalyze ? "text-emerald-700" : "text-slate-500"}`}>
            {stickyHelper}
          </p>
          <PrimaryButton onClick={analyze} disabled={!canAnalyze}>
            {stickyAnalyzeLabel}
          </PrimaryButton>
        </div>
      </div>
    </AppShell>
  );
}

function getAnalyzeHelper({
  canAnalyze,
  fileInputType,
  hasFile,
  textLength,
  textMode,
}: {
  canAnalyze: boolean;
  fileInputType: FileInputType | null;
  hasFile: boolean;
  textLength: number;
  textMode: boolean;
}) {
  if (hasFile) {
    if (fileInputType === "pdf") return "PDF ready to analyze";
    if (fileInputType === "camera") return "Photo ready to analyze";
    return "Image ready to analyze";
  }

  if (canAnalyze) {
    return "Text ready to analyze";
  }

  if (textMode && textLength > 0) {
    const remaining = Math.max(80 - textLength, 0);
    return `Add ${remaining} more characters to analyze`;
  }

  return "Add a photo, PDF, image, or pasted text";
}

function SelectedFileCard({
  file, inputType, onUploadImage, onChange, onRemove, previewUrl, tipsOpen, onToggleTips, ti,
}: {
  file: File; inputType: FileInputType; onUploadImage: () => void; onChange: () => void;
  onRemove: () => void; previewUrl: string; tipsOpen: boolean; onToggleTips: () => void;
  ti: T["input"];
}) {
  const isPhotoInput = inputType === "camera" || inputType === "image";
  return (
    <section className="app-card-subtle p-4">
      {isPhotoInput && previewUrl ? (
        <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          <div className="relative aspect-[4/5] max-h-[360px] w-full">
            <div role="img" className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${previewUrl})` }} />
            <div className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold text-civic-700 shadow-soft">{ti.preview}</div>
          </div>
        </div>
      ) : null}
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-civic-100 text-civic-700">
          {isPhotoInput ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">{getSelectedFileTitle(inputType, ti)}</p>
            <span className="inline-flex min-h-[24px] items-center gap-1 rounded-full bg-mint px-2 text-[11px] font-bold text-emerald-700">
              <CheckCircle2 className="h-3 w-3" />{ti.fileReady}
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-slate-700">{file.name || getFileSourceLabel(inputType, ti)}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{formatFileSize(file.size)}</p>
        </div>
      </div>
      {isPhotoInput ? (
        <button type="button" onClick={onToggleTips} className="touch-target mt-3 flex w-full items-center justify-between rounded-xl border border-civic-100 bg-civic-50 px-3 py-2 text-xs font-semibold text-civic-700">
          <span>{ti.tipsBtn}</span>
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${tipsOpen ? "rotate-180" : ""}`} />
        </button>
      ) : null}
      {isPhotoInput && tipsOpen ? (
        <div className="mt-2 rounded-xl border border-civic-100 bg-civic-50 px-3 pb-3 pt-1">
          <div className="mt-2 grid gap-2">
            {[ti.tip1, ti.tip2, ti.tip3].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" /><span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={onChange} className="touch-target inline-flex items-center justify-center gap-2 rounded-xl border border-civic-200 bg-white px-3 text-xs font-semibold text-civic-700 active:bg-civic-50">
          <RefreshCw className="h-4 w-4" />{inputType === "camera" ? ti.retakePhoto : ti.changeFile}
        </button>
        <button type="button" onClick={onRemove} className="touch-target inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 active:bg-slate-50">
          <Trash2 className="h-4 w-4" />{ti.removeFile}
        </button>
      </div>
      {inputType === "camera" ? (
        <button type="button" onClick={onUploadImage} className="touch-target mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 active:bg-slate-50">
          <ImageIcon className="h-4 w-4" />{ti.noCamera}
        </button>
      ) : null}
    </section>
  );
}

function InputOption({ active, icon, onClick, text, title }: { active: boolean; icon: React.ReactNode; onClick: () => void; text: string; title: string }) {
  return (
    <button type="button" onClick={onClick} className={`touch-target flex min-h-[126px] flex-col items-center justify-center rounded-[18px] border p-3 text-center shadow-soft active:scale-[0.99] ${active ? "border-civic-500 bg-civic-100 text-civic-800" : "border-slate-200 bg-white text-slate-700"}`}>
      <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-white text-civic-700" : "bg-civic-100 text-civic-700"}`}>{icon}</span>
      <span className="text-xs font-bold leading-4 text-ink">{title}</span>
      <span className="mt-1 text-[11px] leading-4 text-slate-500">{text}</span>
    </button>
  );
}

function validateFile(file: File, inputType: FileInputType, ti: T["input"]) {
  if (inputType === "pdf") {
    if (file.type !== "application/pdf") return ti.fileTypeErrorPdf;
    if (file.size > maxPdfSize) return ti.fileSizeError("pdf");
    return "";
  }
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return ti.fileTypeErrorImage;
  if (file.size > maxImageSize) return ti.fileSizeError("image");
  return "";
}

function getFileSourceLabel(inputType: FileInputType, ti: T["input"]) {
  if (inputType === "pdf") return ti.fileSourcePdf;
  if (inputType === "camera") return ti.fileSourceCamera;
  return ti.fileSourceImage;
}

function getSelectedFileTitle(inputType: FileInputType, ti: T["input"]) {
  if (inputType === "pdf") return ti.fileSelectedPdf;
  if (inputType === "camera") return ti.fileSelectedCamera;
  return ti.fileSelectedImage;
}

function getFileTypeLabel(inputType: FileInputType, ti: T["input"]) {
  if (inputType === "pdf") return "PDF";
  if (inputType === "camera") return ti.fileSourceCamera;
  return ti.fileSourceImage;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
