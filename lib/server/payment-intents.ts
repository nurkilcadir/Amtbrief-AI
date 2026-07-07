import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { createPaymentTransaction } from "@/lib/server/payment-merchant";
import { createPaymentRecord } from "@/lib/server/payment-store";

export type PendingPaymentIntent = {
  amountCents: number;
  createdAt: string;
  description: string;
  expiresAt: number;
  id: string;
  scanId: string;
  sourceLabel: string;
  userId: string;
};

type PaymentIntentStore = {
  intents: PendingPaymentIntent[];
  version: 1;
};

const intentTtlMs = 30 * 60 * 1000;
const defaultStore: PaymentIntentStore = { intents: [], version: 1 };

export async function rememberPendingPaymentIntent(input: {
  amountCents: number;
  description?: string;
  scanId: string;
  sourceLabel?: string;
  userId: string;
}) {
  const now = Date.now();
  const intent: PendingPaymentIntent = {
    amountCents: input.amountCents,
    createdAt: new Date(now).toISOString(),
    description: input.description || "Payment",
    expiresAt: now + intentTtlMs,
    id: randomUUID(),
    scanId: input.scanId,
    sourceLabel: input.sourceLabel ?? "Official letter",
    userId: input.userId,
  };

  const store = await readStore();
  await writeStore({
    version: 1,
    intents: [
      ...store.intents.filter((item) => item.userId !== input.userId),
      intent,
    ],
  });

  return intent;
}

export async function applyPaymentChoice(input: {
  appUrl: string;
  responseText: string;
  userId: string;
}) {
  const normalized = input.responseText.toLowerCase();

  if (!normalized.includes("pay now") && !normalized.includes("pay in deutschland app")) {
    if (normalized.includes("manual transfer") || normalized.includes("bank transfer")) {
      await forgetPendingPaymentIntent(input.userId);
      return { action: "manual_transfer_selected" as const };
    }

    return { action: "ignored" as const };
  }

  const intent = await getLatestPendingPaymentIntent(input.userId);

  if (!intent) {
    return { action: "missing_intent" as const };
  }

  const merchantCallback = `${input.appUrl.replace(/\/$/, "")}/api/webhooks/payment?scanId=${encodeURIComponent(intent.scanId)}`;
  const result = await createPaymentTransaction({
    amountCents: intent.amountCents,
    idempotencyId: randomUUID(),
    merchantCallback,
    merchantName: "AmtBrief AI",
    paymentContent: [
      { key: intent.description || "Payment", value: formatEuro(intent.amountCents) },
    ],
    userId: input.userId,
  });

  await createPaymentRecord({
    amountCents: intent.amountCents,
    scanId: intent.scanId,
    sourceLabel: intent.sourceLabel,
    transactionId: result.transactionId,
    userId: input.userId,
  });
  await forgetPendingPaymentIntent(input.userId);

  return {
    action: "payment_created" as const,
    intent,
    result,
  };
}

async function getLatestPendingPaymentIntent(userId: string) {
  const now = Date.now();
  const store = await readStore();
  const intents = store.intents.filter((item) => item.expiresAt > now);
  const latest = intents
    .filter((item) => item.userId === userId)
    .sort((a, b) => b.expiresAt - a.expiresAt)[0] ?? null;

  if (intents.length !== store.intents.length) {
    await writeStore({ version: 1, intents });
  }

  return latest;
}

async function forgetPendingPaymentIntent(userId: string) {
  const store = await readStore();
  await writeStore({
    version: 1,
    intents: store.intents.filter((item) => item.userId !== userId),
  });
}

async function readStore(): Promise<PaymentIntentStore> {
  try {
    const raw = await readFile(getStorePath(), "utf8");
    const parsed = JSON.parse(raw) as PaymentIntentStore;
    return {
      intents: Array.isArray(parsed.intents) ? parsed.intents : [],
      version: 1,
    };
  } catch {
    return defaultStore;
  }
}

async function writeStore(store: PaymentIntentStore) {
  await mkdir(getStoreDir(), { recursive: true });
  await writeFile(getStorePath(), JSON.stringify(store, null, 2));
}

function formatEuro(cents: number) {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

function getStorePath() {
  return `${getStoreDir()}/payment-intents.json`;
}

function getStoreDir() {
  return process.env.REMINDER_STORE_DIR ?? "/tmp/amtbrief-ai";
}
