import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";

export type StoredSignatureStatus = "failed" | "requested" | "signed";

export type StoredSignature = {
  id: string;
  callbackEvents: number;
  createdAt: string;
  failureReason: string | null;
  fileName: string;
  mediaId: string | null;
  mpowerInstanceId: string | null;
  mpowerMessageId: string | null;
  openedAt: string | null;
  scanId: string;
  signedAt: string | null;
  sourceLabel: string;
  status: StoredSignatureStatus;
  updatedAt: string;
  userId: string;
};

type SignatureCallbackEvent = {
  createdAt: string;
  fileName: string | null;
  mediaId: string | null;
  signatureStatus: string;
  userId: string;
};

type SignatureStore = {
  callbacks: SignatureCallbackEvent[];
  signatures: StoredSignature[];
  version: 1;
};

type StoreMutationResult<T> = {
  data: T;
  store: SignatureStore;
};

type SignatureCallbackResult = {
  action: "failed" | "ignored" | "signed";
  signature: StoredSignature | null;
};

const defaultStore: SignatureStore = {
  callbacks: [],
  signatures: [],
  version: 1,
};

export async function createSignatureRequestRecord(input: {
  scanId: string;
  sourceLabel: string;
  userId: string;
}) {
  const now = new Date().toISOString();
  const id = `sig_${randomUUID()}`;
  const signature: StoredSignature = {
    id,
    callbackEvents: 0,
    createdAt: now,
    failureReason: null,
    fileName: createSignatureFileName(id),
    mediaId: null,
    mpowerInstanceId: null,
    mpowerMessageId: null,
    openedAt: null,
    scanId: input.scanId,
    signedAt: null,
    sourceLabel: input.sourceLabel || "Official letter",
    status: "requested",
    updatedAt: now,
    userId: input.userId,
  };

  return mutateStore((store) => ({
    data: signature,
    store: {
      ...store,
      signatures: [...store.signatures, signature],
    },
  }));
}

export async function markSignatureSent(input: {
  id: string;
  mpowerInstanceId?: string;
  mpowerMessageId?: string;
}) {
  const updatedAt = new Date().toISOString();

  return updateSignature(input.id, (signature) => ({
    ...signature,
    failureReason: null,
    mpowerInstanceId: input.mpowerInstanceId ?? null,
    mpowerMessageId: input.mpowerMessageId ?? null,
    status: "requested",
    updatedAt,
  }));
}

export async function markSignatureFailed(id: string, failureReason: string) {
  const updatedAt = new Date().toISOString();

  return updateSignature(id, (signature) => ({
    ...signature,
    failureReason,
    status: "failed",
    updatedAt,
  }));
}

export async function applySignatureCallback(input: {
  fileName?: string | null;
  mediaId?: string | null;
  signatureStatus: string;
  userId: string;
}) {
  const updatedAt = new Date().toISOString();
  const matchedId = input.fileName ? extractSignatureId(input.fileName) : null;
  const normalizedStatus = input.signatureStatus.toLowerCase();

  return mutateStore<SignatureCallbackResult>((store) => {
    const latestForUser = [...store.signatures]
      .filter(
        (signature) =>
          signature.userId === input.userId &&
          signature.status === "requested",
      )
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0];
    const target =
      (matchedId && store.signatures.find((signature) => signature.id === matchedId)) ||
      latestForUser ||
      null;
    const callbacks = [
      ...store.callbacks,
      {
        createdAt: updatedAt,
        fileName: input.fileName ?? null,
        mediaId: input.mediaId ?? null,
        signatureStatus: input.signatureStatus,
        userId: input.userId,
      },
    ].slice(-100);

    if (!target) {
      return {
        data: { action: "ignored", signature: null },
        store: {
          ...store,
          callbacks,
        },
      };
    }

    const action: Extract<SignatureCallbackResult["action"], "failed" | "signed"> =
      normalizedStatus === "signed" && input.mediaId ? "signed" : "failed";
    const signatures = store.signatures.map((signature) => {
      if (signature.id !== target.id) return signature;

      return {
        ...signature,
        callbackEvents: signature.callbackEvents + 1,
        failureReason:
          action === "failed"
            ? input.signatureStatus || "Signature was not completed"
            : null,
        mediaId: action === "signed" ? input.mediaId! : signature.mediaId,
        signedAt: action === "signed" ? updatedAt : signature.signedAt,
        status: action,
        updatedAt,
      };
    });
    const signature = signatures.find((item) => item.id === target.id) ?? null;

    return {
      data: { action, signature },
      store: {
        ...store,
        callbacks,
        signatures,
      },
    };
  });
}

export async function getLatestSignatureForScan(input: {
  scanId: string;
  userId: string;
}) {
  const store = await readStore();

  return (
    [...store.signatures]
      .filter(
        (signature) =>
          signature.scanId === input.scanId && signature.userId === input.userId,
      )
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ??
    null
  );
}

export async function getSignatureById(id: string) {
  const store = await readStore();
  return store.signatures.find((signature) => signature.id === id) ?? null;
}

export function toClientSignature(signature: StoredSignature | null) {
  if (!signature) return null;

  return {
    createdAt: signature.createdAt,
    downloadUrl:
      signature.status === "signed"
        ? `/api/signatures/${encodeURIComponent(signature.id)}/download`
        : null,
    failureReason: signature.failureReason,
    fileName: signature.fileName,
    id: signature.id,
    signedAt: signature.signedAt,
    sourceLabel: signature.sourceLabel,
    status: signature.status,
    updatedAt: signature.updatedAt,
  };
}

function createSignatureFileName(id: string) {
  return `amtbrief-signature-${id}.pdf`;
}

function extractSignatureId(fileName: string) {
  const match = fileName.match(/amtbrief-signature-(sig_[a-f0-9-]+)\.pdf/i);
  return match?.[1] ?? null;
}

async function updateSignature(
  id: string,
  update: (signature: StoredSignature) => StoredSignature,
) {
  return mutateStore((store) => {
    const signatures = store.signatures.map((signature) =>
      signature.id === id ? update(signature) : signature,
    );
    const signature = signatures.find((item) => item.id === id) ?? null;

    return {
      data: signature,
      store: {
        ...store,
        signatures,
      },
    };
  });
}

async function mutateStore<T>(
  mutation: (store: SignatureStore) => StoreMutationResult<T>,
) {
  const store = await readStore();
  const result = mutation(store);
  await writeStore(result.store);
  return result.data;
}

async function readStore(): Promise<SignatureStore> {
  try {
    const raw = await readFile(getStorePath(), "utf8");
    const parsed = JSON.parse(raw) as SignatureStore;

    return {
      callbacks: Array.isArray(parsed.callbacks) ? parsed.callbacks : [],
      signatures: Array.isArray(parsed.signatures) ? parsed.signatures : [],
      version: 1,
    };
  } catch {
    return defaultStore;
  }
}

async function writeStore(store: SignatureStore) {
  await mkdir(getStoreDir(), { recursive: true });
  await writeFile(getStorePath(), JSON.stringify(store, null, 2));
}

function getStorePath() {
  return `${getStoreDir()}/signatures.json`;
}

function getStoreDir() {
  return process.env.SIGNATURE_STORE_DIR ?? process.env.REMINDER_STORE_DIR ?? "/tmp/amtbrief-ai";
}
