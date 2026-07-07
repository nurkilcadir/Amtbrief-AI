import type { CapacitorConfig } from "@capacitor/cli";

// AmtBrief AI — standalone mobile shell (Capacitor).
//
// Phase 1 strategy: the Next.js app (UI + API routes) keeps running as a
// server. The native shell loads it in a WebView and adds native plugins
// (camera, local notifications, ...). Only the SuperApp-specific bridges
// (mPower chat / signature / payment, Silent SSO) get native replacements.
//
// DEV:  server.url points at the local Next.js dev server on the LAN, so the
//       app runs on a real device / simulator with the full backend and live
//       reload. Update the IP to match `ipconfig getifaddr en0`.
// PROD: replace server.url with your standalone hosted deployment URL (a
//       separate deploy from the SuperApp MiniApp, with its own auth), or
//       drop server.url and bundle a static frontend that calls the hosted API.

const DEV_SERVER = "http://10.92.10.88:4173";

const config: CapacitorConfig = {
  appId: "ai.amtbrief.app",
  appName: "AmtBrief AI",
  webDir: "capacitor-shell",
  ios: {
    contentInset: "always",
  },
  server: {
    url: process.env.CAP_SERVER_URL ?? DEV_SERVER,
    cleartext: true,
  },
};

export default config;
