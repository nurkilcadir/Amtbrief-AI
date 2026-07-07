"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Landmark, Loader2, Mail, ArrowRight } from "lucide-react";

type Providers = {
  google: boolean;
  apple: boolean;
  email: boolean;
};

const ERRORS: Record<string, string> = {
  state: "Sign-in session expired. Please try again.",
  google_unavailable: "Google sign-in is not configured yet.",
  google_cancelled: "Google sign-in was cancelled.",
  google_failed: "Google sign-in failed. Please try again.",
  apple_unavailable: "Apple sign-in is not configured yet.",
  apple_cancelled: "Apple sign-in was cancelled.",
  apple_failed: "Apple sign-in failed. Please try again.",
};

function LoginInner() {
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<Providers>({ google: false, apple: false, email: true });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "guest">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError && ERRORS[urlError]) setError(ERRORS[urlError]);
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((p: Providers) => setProviders({ google: !!p.google, apple: !!p.apple, email: p.email !== false }))
      .catch(() => {});
  }, []);

  async function signIn(payload: { email?: string; name?: string; guest?: boolean }) {
    setError("");
    setStatus(payload.guest ? "guest" : "submitting");
    try {
      const response = await fetch("/api/auth/standalone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Sign-in failed. Please try again.");
      }
      window.location.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
      setStatus("idle");
    }
  }

  function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    void signIn({ email, name });
  }

  const busy = status !== "idle";
  const hasSocial = providers.google || providers.apple;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[430px] flex-col justify-center bg-civic-50 px-6 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-[calc(env(safe-area-inset-top)+28px)]">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-civic-100 text-civic-700 shadow-soft">
          <Landmark className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-ink">AmtBrief AI</h1>
        <p className="mt-2 max-w-[280px] text-sm leading-6 text-slate-600">
          Sign in to analyze your official German letters and track what to do next.
        </p>
      </div>

      {hasSocial ? (
        <div className="space-y-3">
          {providers.google ? (
            <a
              href="/api/auth/google/start"
              className="touch-target flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-[15px] font-semibold text-slate-800 shadow-soft active:scale-[0.99]"
            >
              <GoogleIcon />
              Continue with Google
            </a>
          ) : null}
          {providers.apple ? (
            <a
              href="/api/auth/apple/start"
              className="touch-target flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-[15px] font-semibold text-slate-800 shadow-soft active:scale-[0.99]"
            >
              <AppleIcon />
              Continue with Apple
            </a>
          ) : null}
        </div>
      ) : null}

      {hasSocial ? (
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium text-slate-400">or</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
      ) : (
        <div className="h-2" />
      )}

      <form onSubmit={submitEmail} className="space-y-3">
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-11 pr-4 text-[16px] text-slate-900 outline-none ring-civic-500/20 transition focus:border-civic-500 focus:ring-4"
          />
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-[16px] text-slate-900 outline-none ring-civic-500/20 transition focus:border-civic-500 focus:ring-4"
        />
        {error ? (
          <p className="rounded-xl border border-rose-200 bg-roseSoft px-3 py-2.5 text-sm leading-5 text-rose-800">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="touch-target flex w-full items-center justify-center gap-2 rounded-xl bg-civic-600 px-5 py-3.5 text-[15px] font-semibold text-white shadow-action active:scale-[0.99] disabled:opacity-60"
        >
          {status === "submitting" ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
          Continue with email
        </button>
      </form>

      <button
        type="button"
        disabled={busy}
        onClick={() => void signIn({ guest: true })}
        className="touch-target mx-auto mt-5 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-civic-700 active:bg-civic-100 disabled:opacity-60"
      >
        {status === "guest" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Continue as guest
      </button>

      <p className="mt-6 text-center text-[11px] leading-5 text-slate-400">
        AmtBrief AI helps you understand and prepare documents. It is not legal advice.
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 12 2 2 12 2 24s10 22 22 22c11 0 21-8 21-22 0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 15.7 2 8.6 6.7 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 46c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.5-4.7 2.5-7.6 2.5-5.2 0-9.6-3.3-11.2-8l-6.6 5.1C8.5 41.2 15.6 46 24 46z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.5 5.5C41.4 36.3 44 30.8 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.4 12.9c0-2.6 2.1-3.9 2.2-4-1.2-1.8-3.1-2-3.8-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.1 2.5-1.8 3.1-.5 7.6 1.3 10.1.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.2 3.1-2.5.6-.9.9-1.4 1.4-2.4-3.5-1.4-3.9-6.3-.9-8.2zM14 4.9c.7-.8 1.1-2 1-3.2-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.5 2.9-1.3z" />
    </svg>
  );
}
