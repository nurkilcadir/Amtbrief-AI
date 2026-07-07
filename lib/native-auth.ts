"use client";

// Native (Capacitor) social sign-in. Google/Apple block OAuth inside embedded
// WebViews, so we open the flow in the system browser and catch the result via
// the amtbrief:// deep link, then exchange the one-time code for a session
// cookie inside the app's own WebView.

export async function isNativePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function nativeSocialLogin(provider: "google" | "apple"): Promise<void> {
  const { Browser } = await import("@capacitor/browser");
  const { App } = await import("@capacitor/app");

  const startUrl = `${window.location.origin}/api/auth/${provider}/start?mode=native`;

  const code = await new Promise<string>((resolve, reject) => {
    let settled = false;
    let handle: { remove: () => void } | null = null;

    const cleanup = () => {
      handle?.remove();
      clearTimeout(timer);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Sign-in timed out."));
    }, 180000);

    App.addListener("appUrlOpen", async ({ url }) => {
      if (settled || !url.startsWith("amtbrief://auth")) return;
      settled = true;
      cleanup();
      await Browser.close().catch(() => {});
      const value = new URL(url).searchParams.get("code");
      if (value) resolve(value);
      else reject(new Error("Sign-in was cancelled."));
    }).then((h) => {
      handle = h;
    });

    Browser.open({ url: startUrl }).catch((err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    });
  });

  const response = await fetch("/api/auth/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) {
    throw new Error("Sign-in could not be completed.");
  }

  window.location.replace("/");
}
