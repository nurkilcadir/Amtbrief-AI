const checklistIntentKey = "amtbrief-ai-open-checklist-intent-v1";
const internalNavigationKey = "amtbrief-ai-internal-navigation-v1";
const checklistIntentTtlMs = 30 * 60 * 1000;
const internalNavigationWindowMs = 2500;

type ChecklistOpenIntent = {
  expiresAt: number;
  scanId: string;
};

export function rememberLocalChecklistOpenIntent(scanId: string) {
  if (typeof window === "undefined") return;

  const intent: ChecklistOpenIntent = {
    expiresAt: Date.now() + checklistIntentTtlMs,
    scanId,
  };

  window.localStorage.setItem(checklistIntentKey, JSON.stringify(intent));
}

export function consumeLocalChecklistOpenIntent() {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(checklistIntentKey);
  window.localStorage.removeItem(checklistIntentKey);

  if (!raw) return null;

  try {
    const intent = JSON.parse(raw) as Partial<ChecklistOpenIntent>;

    if (!intent.scanId || !intent.expiresAt || intent.expiresAt <= Date.now()) {
      return null;
    }

    return {
      scanId: intent.scanId,
    };
  } catch {
    return null;
  }
}

export function markInternalNavigation() {
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(internalNavigationKey, String(Date.now()));
}

export function wasRecentInternalNavigation() {
  if (typeof window === "undefined") return false;

  const timestamp = Number(window.sessionStorage.getItem(internalNavigationKey));
  window.sessionStorage.removeItem(internalNavigationKey);

  return Number.isFinite(timestamp) && Date.now() - timestamp < internalNavigationWindowMs;
}
