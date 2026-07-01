"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  ClipboardType,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAmtBrief } from "@/components/AmtBriefProvider";
import { AnalysisInputType } from "@/lib/types";
import { findSampleLetterByText, sampleLetters } from "@/lib/sample-documents";

type FileInputType = Extract<AnalysisInputType, "pdf" | "image" | "camera">;

const maxPdfSize = 15 * 1024 * 1024;
const maxImageSize = 8 * 1024 * 1024;

export default function InputPage() {
  const router = useRouter();
  const { documentText, setDocument, setDocumentFile } = useAmtBrief();
  const [text, setText] = useState(documentText);
  const [file, setFile] = useState<File | null>(null);
  const [fileInputType, setFileInputType] = useState<FileInputType | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [textMode, setTextMode] = useState(Boolean(documentText));
  const [error, setError] = useState("");
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
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  function updatePreviewUrl(nextUrl: string) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  }

  function handleFile(
    event: ChangeEvent<HTMLInputElement>,
    inputType: FileInputType,
  ) {
    const nextFile = event.target.files?.[0] ?? null;
    event.target.value = "";
    setError("");

    if (!nextFile) return;

    const validationError = validateFile(nextFile, inputType);
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
    if (fileInputType === "pdf") {
      pdfInputRef.current?.click();
      return;
    }

    if (fileInputType === "camera") {
      cameraInputRef.current?.click();
      return;
    }

    imageInputRef.current?.click();
  }

  function analyze() {
    if (file && fileInputType) {
      setDocumentFile(file, file.name || getFileSourceLabel(fileInputType), fileInputType);
      router.push("/analysis");
      return;
    }

    if (text.trim().length < 80) {
      setError("Paste at least 80 characters from the letter.");
      return;
    }

    const matchedSample = findSampleLetterByText(text);
    const label = matchedSample ? matchedSample.title : "Pasted letter";
    const inputType: AnalysisInputType = matchedSample ? "example" : "text";
    setDocument(text, label, inputType);
    router.push("/analysis");
  }

  const canAnalyze = Boolean(file) || text.trim().length >= 80;
  const trimmedLength = text.trim().length;
  const textReady = trimmedLength >= 80;
  const analyzeLabel = file
    ? `Analyze ${getFileAnalyzeLabel(fileInputType ?? "image")}`
    : "Analyze letter";

  return (
    <AppShell title="Analyze letter" eyebrow="AmtBrief AI">
      <div className="space-y-4">
        <section className="app-card p-5">
          <h2 className="text-2xl font-bold leading-tight text-ink">
            Understand your letter
          </h2>
          <p className="mt-3 text-[15px] leading-6 text-slate-600">
            Upload or photograph a German official letter. AmtBrief AI will
            explain it and create your next steps.
          </p>
        </section>

        <section className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-civic-100 text-civic-700">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <p className="text-sm leading-5 text-slate-600">
              Your analyzed document is saved in My Scans so you can return to
              it later. Upload only the pages needed for this request.
            </p>
          </div>
        </section>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => handleFile(event, "camera")}
          aria-hidden="true"
          tabIndex={-1}
          className="hidden"
        />
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          onChange={(event) => handleFile(event, "pdf")}
          aria-hidden="true"
          tabIndex={-1}
          className="hidden"
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => handleFile(event, "image")}
          aria-hidden="true"
          tabIndex={-1}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className={`touch-target flex w-full items-center gap-4 rounded-[20px] bg-civic-600 px-5 py-5 text-left text-white shadow-action active:scale-[0.99] ${
            fileInputType === "camera" ? "ring-4 ring-civic-200" : ""
          }`}
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-civic-700">
            <Camera className="h-7 w-7" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold">Take photo</span>
            <span className="mt-1 block text-xs font-medium leading-5 text-civic-100">
              Use your camera to scan a paper letter
            </span>
          </span>
        </button>

        <section className="grid grid-cols-3 gap-2">
          <InputOption
            active={fileInputType === "pdf"}
            icon={<UploadCloud className="h-5 w-5" />}
            title="Upload PDF"
            text="Email or portal"
            onClick={() => pdfInputRef.current?.click()}
          />
          <InputOption
            active={fileInputType === "image"}
            icon={<ImageIcon className="h-5 w-5" />}
            title="Upload image"
            text="From gallery"
            onClick={() => imageInputRef.current?.click()}
          />
          <InputOption
            active={textMode}
            icon={<ClipboardType className="h-5 w-5" />}
            title="Paste text"
            text="Copied letter"
            onClick={() => {
              setTextMode(true);
              setFile(null);
              setFileInputType(null);
              updatePreviewUrl("");
              setError("");
            }}
          />
        </section>

        {file ? (
          <SelectedFileCard
            file={file}
            inputType={fileInputType ?? "image"}
            previewUrl={previewUrl}
            onChange={changeSelectedFile}
            onUploadImage={() => imageInputRef.current?.click()}
            onRemove={clearFile}
          />
        ) : null}

        {textMode ? (
          <section className="app-card p-4">
            <label htmlFor="letter" className="text-sm font-semibold text-slate-700">
              Letter text
            </label>
            <textarea
              id="letter"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setError("");
              }}
              placeholder="Paste the official German letter here..."
              className="mt-2 min-h-[244px] w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-[16px] leading-6 text-slate-900 outline-none ring-civic-500/20 transition focus:border-civic-500 focus:bg-white focus:ring-4"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <div
                className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${
                  textReady
                    ? "bg-mint text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {textReady ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                {trimmedLength}/80 minimum
              </div>
              {text ? (
                <button
                  type="button"
                  onClick={clearText}
                  className="touch-target inline-flex items-center justify-center rounded-lg px-2 text-xs font-semibold text-slate-500 active:bg-slate-100"
                >
                  Clear text
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {error ? (
          <section className="rounded-[16px] border border-rose-200 bg-roseSoft p-3 text-sm leading-5 text-rose-800">
            {error}
          </section>
        ) : null}

        <div className="grid gap-3 pb-2">
          <PrimaryButton onClick={analyze} disabled={!canAnalyze}>
            {analyzeLabel}
          </PrimaryButton>
        </div>

        <section className="app-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Sparkles className="h-4 w-4 text-civic-600" />
            Sample letters
          </div>
          <p className="mb-3 text-xs leading-5 text-slate-500">
            No letter handy? Try one of these to see how AmtBrief AI handles
            different risk levels, deadlines, and the payment flow.
          </p>
          <div className="space-y-2">
            {sampleLetters.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => applySample(sample.text)}
                className="touch-target flex w-full flex-col items-start gap-1 rounded-2xl border border-slate-200 bg-white p-3 text-left transition active:scale-[0.99] active:bg-slate-50"
              >
                <span className="text-sm font-semibold text-ink">{sample.title}</span>
                <span className="inline-flex min-h-[24px] items-center rounded-full bg-civic-100 px-2.5 text-[11px] font-bold text-civic-700">
                  {sample.tag}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function SelectedFileCard({
  file,
  inputType,
  onUploadImage,
  onChange,
  onRemove,
  previewUrl,
}: {
  file: File;
  inputType: FileInputType;
  onUploadImage: () => void;
  onChange: () => void;
  onRemove: () => void;
  previewUrl: string;
}) {
  const isPhotoInput = inputType === "camera" || inputType === "image";

  return (
    <section className="app-card-subtle p-4">
      {isPhotoInput && previewUrl ? (
        <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          <div className="relative aspect-[4/5] max-h-[360px] w-full">
            <div
              role="img"
              aria-label={
                inputType === "camera" ? "Camera photo preview" : "Uploaded image preview"
              }
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${previewUrl})` }}
            />
            <div className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold text-civic-700 shadow-soft">
              Preview
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-civic-100 text-civic-700">
          {isPhotoInput ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">
              {getSelectedFileTitle(inputType)}
            </p>
            <span className="inline-flex min-h-[24px] items-center gap-1 rounded-full bg-mint px-2 text-[11px] font-bold text-emerald-700">
              <CheckCircle2 className="h-3 w-3" />
              Ready
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-slate-700">
            {file.name || getFileSourceLabel(inputType)}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {formatFileSize(file.size)} · {getFileHelperText(inputType)}
          </p>
        </div>
      </div>

      {isPhotoInput ? <PhotoQualityChecklist inputType={inputType} /> : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onChange}
          className="touch-target inline-flex items-center justify-center gap-2 rounded-xl border border-civic-200 bg-white px-3 text-xs font-semibold text-civic-700 active:bg-civic-50"
        >
          <RefreshCw className="h-4 w-4" />
          {inputType === "camera" ? "Retake photo" : "Change file"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="touch-target inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 active:bg-slate-50"
        >
          <Trash2 className="h-4 w-4" />
          Remove
        </button>
      </div>

      {inputType === "camera" ? (
        <button
          type="button"
          onClick={onUploadImage}
          className="touch-target mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 active:bg-slate-50"
        >
          <ImageIcon className="h-4 w-4" />
          Camera unavailable? Upload image
        </button>
      ) : null}
    </section>
  );
}

function PhotoQualityChecklist({ inputType }: { inputType: FileInputType }) {
  const intro =
    inputType === "camera"
      ? "Before analyzing this photo"
      : "Before analyzing this image";

  return (
    <div className="mt-4 rounded-2xl border border-civic-100 bg-civic-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-civic-700">
        {intro}
      </p>
      <div className="mt-3 grid gap-2">
        {[
          "Whole letter is visible",
          "Text is readable and not blurred",
          "No strong shadows or glare",
        ].map((item) => (
          <div key={item} className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InputOption({
  active,
  icon,
  onClick,
  text,
  title,
}: {
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  text: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`touch-target flex min-h-[126px] flex-col items-center justify-center rounded-[18px] border p-3 text-center shadow-soft active:scale-[0.99] ${
        active
          ? "border-civic-500 bg-civic-100 text-civic-800"
          : "border-slate-200 bg-white text-slate-700"
      }`}
    >
      <span
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
          active ? "bg-white text-civic-700" : "bg-civic-100 text-civic-700"
        }`}
      >
        {icon}
      </span>
      <span className="text-xs font-bold leading-4 text-ink">{title}</span>
      <span className="mt-1 text-[11px] leading-4 text-slate-500">{text}</span>
    </button>
  );
}

function validateFile(file: File, inputType: FileInputType) {
  if (inputType === "pdf") {
    if (file.type !== "application/pdf") {
      return "Please upload a PDF file.";
    }

    if (file.size > maxPdfSize) {
      return "PDF files must be 15MB or smaller.";
    }

    return "";
  }

  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return "Images must be PNG, JPG, JPEG, or WEBP.";
  }

  if (file.size > maxImageSize) {
    return "Image files must be 8MB or smaller.";
  }

  return "";
}

function getFileSourceLabel(inputType: FileInputType) {
  if (inputType === "pdf") return "Uploaded PDF";
  if (inputType === "camera") return "Camera photo";
  return "Uploaded image";
}

function getSelectedFileTitle(inputType: FileInputType) {
  if (inputType === "pdf") return "Selected PDF";
  if (inputType === "camera") return "Photo ready";
  return "Selected image";
}

function getFileAnalyzeLabel(inputType: FileInputType) {
  if (inputType === "pdf") return "PDF";
  if (inputType === "camera") return "photo";
  return "image";
}

function getFileHelperText(inputType: FileInputType) {
  if (inputType === "pdf") {
    return "The PDF will be sent for analysis when you tap Analyze letter.";
  }

  if (inputType === "camera") {
    return "The camera photo will be sent for analysis when you tap Analyze letter.";
  }

  return "The image will be sent for analysis when you tap Analyze letter.";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
