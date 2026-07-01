import { mkdir, readFile, writeFile } from "fs/promises";

export type StoredPaymentStatus = "new" | "finished" | "failed";

export type StoredPaymentTransaction = {
  transactionId: string;
  userId: string;
  scanId: string;
  sourceLabel: string;
  amountCents: number;
  status: StoredPaymentStatus;
  rawStatus: string | null;
  createdAt: string;
  updatedAt: string;
  failureReason: string | null;
};

type PaymentStore = {
  transactions: StoredPaymentTransaction[];
  version: 1;
};

const defaultStore: PaymentStore = { transactions: [], version: 1 };

export async function createPaymentRecord(input: {
  transactionId: string;
  userId: string;
  scanId: string;
  sourceLabel: string;
  amountCents: number;
}) {
  const now = new Date().toISOString();
  const record: StoredPaymentTransaction = {
    transactionId: input.transactionId,
    userId: input.userId,
    scanId: input.scanId,
    sourceLabel: input.sourceLabel,
    amountCents: input.amountCents,
    status: "new",
    rawStatus: "new",
    createdAt: now,
    updatedAt: now,
    failureReason: null,
  };

  return mutateStore(record.transactionId, (store) => ({
    data: record,
    store: { ...store, transactions: [...store.transactions, record] },
  }));
}

export async function updatePaymentStatus(input: {
  transactionId: string;
  status: StoredPaymentStatus;
  rawStatus: string | null;
  failureReason?: string | null;
}) {
  const updatedAt = new Date().toISOString();

  return mutateStore(input.transactionId, (store) => {
    const transactions = store.transactions.map((transaction) =>
      transaction.transactionId === input.transactionId
        ? {
            ...transaction,
            status: input.status,
            rawStatus: input.rawStatus,
            failureReason: input.failureReason ?? null,
            updatedAt,
          }
        : transaction,
    );

    return {
      data: transactions.find((t) => t.transactionId === input.transactionId) ?? null,
      store: { ...store, transactions },
    };
  });
}

export async function getPaymentByTransactionId(transactionId: string) {
  const store = await readStore();
  return store.transactions.find((t) => t.transactionId === transactionId) ?? null;
}

async function mutateStore<T>(
  _transactionId: string,
  mutation: (store: PaymentStore) => { data: T; store: PaymentStore },
) {
  const store = await readStore();
  const result = mutation(store);
  await writeStore(result.store);
  return result.data;
}

async function readStore(): Promise<PaymentStore> {
  try {
    const raw = await readFile(getStorePath(), "utf8");
    const parsed = JSON.parse(raw) as PaymentStore;
    return {
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      version: 1,
    };
  } catch {
    return defaultStore;
  }
}

async function writeStore(store: PaymentStore) {
  await mkdir(getStoreDir(), { recursive: true });
  await writeFile(getStorePath(), JSON.stringify(store, null, 2));
}

function getStorePath() {
  return `${getStoreDir()}/payments.json`;
}

function getStoreDir() {
  return process.env.REMINDER_STORE_DIR ?? "/tmp/amtbrief-ai";
}
