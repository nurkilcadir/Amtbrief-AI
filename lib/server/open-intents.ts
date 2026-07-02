import type { DocumentSection } from "@/lib/routes";

type DocumentOpenIntent = {
  createdAt: number;
  expiresAt: number;
  section: DocumentSection;
  scanId: string;
};

const documentOpenIntents = new Map<string, DocumentOpenIntent>();
const intentTtlMs = 2 * 60 * 60 * 1000;

export function rememberChecklistOpenIntent(input: {
  scanId: string;
  userId: string;
}) {
  rememberDocumentOpenIntent({
    ...input,
    section: "checklist",
  });
}

export function rememberDocumentOpenIntent(input: {
  scanId: string;
  section: DocumentSection;
  userId: string;
}) {
  cleanupExpiredIntents();

  documentOpenIntents.set(input.userId, {
    createdAt: Date.now(),
    expiresAt: Date.now() + intentTtlMs,
    section: input.section,
    scanId: input.scanId,
  });
}

export function consumeChecklistOpenIntent(userId: string) {
  return consumeDocumentOpenIntent(userId);
}

export function consumeDocumentOpenIntent(userId: string) {
  const intent = documentOpenIntents.get(userId);

  if (!intent) {
    return null;
  }

  documentOpenIntents.delete(userId);

  if (intent.expiresAt <= Date.now()) {
    return null;
  }

  return intent;
}

function cleanupExpiredIntents() {
  const now = Date.now();

  for (const [userId, intent] of documentOpenIntents.entries()) {
    if (intent.expiresAt <= now) {
      documentOpenIntents.delete(userId);
    }
  }
}
