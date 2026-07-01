type ChecklistOpenIntent = {
  createdAt: number;
  expiresAt: number;
  scanId: string;
};

const checklistOpenIntents = new Map<string, ChecklistOpenIntent>();
const intentTtlMs = 2 * 60 * 60 * 1000;

export function rememberChecklistOpenIntent(input: {
  scanId: string;
  userId: string;
}) {
  cleanupExpiredIntents();

  checklistOpenIntents.set(input.userId, {
    createdAt: Date.now(),
    expiresAt: Date.now() + intentTtlMs,
    scanId: input.scanId,
  });
}

export function consumeChecklistOpenIntent(userId: string) {
  const intent = checklistOpenIntents.get(userId);

  if (!intent) {
    return null;
  }

  checklistOpenIntents.delete(userId);

  if (intent.expiresAt <= Date.now()) {
    return null;
  }

  return intent;
}

function cleanupExpiredIntents() {
  const now = Date.now();

  for (const [userId, intent] of checklistOpenIntents.entries()) {
    if (intent.expiresAt <= now) {
      checklistOpenIntents.delete(userId);
    }
  }
}
