"use client";

// Native equivalent of the SuperApp chat: on-device local notifications.
// In the standalone app there is no SuperApp chat to push analysis summaries
// and reminders to, so we notify the user locally and deep-link back into the
// relevant checklist. All of this is native-only — in the SuperApp MiniApp
// (web) none of it runs and the existing mPower chat is used instead.

type ReminderPointLike = { label: string; scheduledAt: string | null };

export async function isNativePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function getLN() {
  const mod = await import("@capacitor/local-notifications");
  return mod.LocalNotifications;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!(await isNativePlatform())) return false;
  const LN = await getLN();
  const current = await LN.checkPermissions();
  if (current.display === "granted") return true;
  const requested = await LN.requestPermissions();
  return requested.display === "granted";
}

export async function notifyAnalysisReady(input: {
  scanId: string;
  title: string;
  openCount: number;
}): Promise<void> {
  if (!(await ensureNotificationPermission())) return;
  const LN = await getLN();
  await LN.schedule({
    notifications: [
      {
        id: notificationId(`analysis:${input.scanId}`),
        title: "Letter analyzed",
        body: `${input.title} — ${input.openCount} open task${input.openCount === 1 ? "" : "s"}`,
        extra: { scanId: input.scanId, section: "checklist" },
      },
    ],
  });
}

export async function scheduleReminderNotifications(input: {
  scanId: string;
  title: string;
  points: ReminderPointLike[];
}): Promise<void> {
  if (!(await ensureNotificationPermission())) return;
  const LN = await getLN();

  const now = Date.now();
  const notifications = input.points
    .filter((p) => p.scheduledAt && Date.parse(p.scheduledAt) > now)
    .map((p, index) => ({
      id: notificationId(`reminder:${input.scanId}:${index}`),
      title: "AmtBrief reminder",
      body: `${p.label} — ${input.title}`,
      schedule: { at: new Date(p.scheduledAt as string) },
      extra: { scanId: input.scanId, section: "checklist" },
    }));

  // Clear any previously scheduled reminders for this scan, then reschedule.
  await clearReminderNotifications(input.scanId, input.points.length).catch(() => {});
  if (notifications.length > 0) {
    await LN.schedule({ notifications });
  }
}

export async function clearReminderNotifications(scanId: string, count = 8): Promise<void> {
  if (!(await isNativePlatform())) return;
  const LN = await getLN();
  const notifications = Array.from({ length: count }, (_, index) => ({
    id: notificationId(`reminder:${scanId}:${index}`),
  }));
  await LN.cancel({ notifications });
}

export async function registerNotificationTapHandler(): Promise<void> {
  if (!(await isNativePlatform())) return;
  const LN = await getLN();
  await LN.removeAllListeners();
  await LN.addListener("localNotificationActionPerformed", (action) => {
    const extra = action.notification.extra as { scanId?: string; section?: string } | undefined;
    if (!extra?.scanId) return;
    const section = extra.section ?? "checklist";
    window.location.assign(`/scans/${extra.scanId}/${section}`);
  });
}

// LocalNotifications requires 32-bit integer ids; derive a stable one.
function notificationId(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (Math.imul(31, hash) + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2147483647;
}
