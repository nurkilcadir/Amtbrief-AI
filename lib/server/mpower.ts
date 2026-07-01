type MpowerToken = {
  accessToken: string;
  expiresAt: number;
};

type MpowerSendResult = {
  instanceId?: string;
  messageId?: string;
};

type MpowerSignatureResult = MpowerSendResult & {
  [key: string]: unknown;
};

let cachedToken: MpowerToken | null = null;

export function hasMpowerConfig() {
  return Boolean(
    process.env.OIDC_ISSUER &&
      getClientId() &&
      process.env.OIDC_CLIENT_SECRET &&
      process.env.MPOWER_BASE_URL &&
      process.env.MPOWER_TENANT,
  );
}

export async function sendReminderChoiceMessage(input: {
  messageText: string;
  userId: string;
}) {
  const token = await getMpowerToken();
  const baseUrl = requireEnv("MPOWER_BASE_URL").replace(/\/$/, "");
  const tenant = requireEnv("MPOWER_TENANT");
  const serviceUuid = getClientId();
  const url = `${baseUrl}/auth/realms/${tenant}/mpower/v1/users/${encodeURIComponent(
    input.userId,
  )}/message`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      serviceUuid,
      messageType: "choiceRequest",
      version: 3,
      messageContent: {
        messageText: input.messageText,
        choices: [
          { text: "I handled it" },
          { text: "Remind me tomorrow" },
          { text: "Open checklist" },
        ],
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`mPower reminder message failed with status ${response.status}`);
  }

  return (await response.json()) as MpowerSendResult;
}

export async function sendPlainMpowerMessage(input: {
  messageText: string;
  userId: string;
}) {
  const token = await getMpowerToken();
  const baseUrl = requireEnv("MPOWER_BASE_URL").replace(/\/$/, "");
  const tenant = requireEnv("MPOWER_TENANT");
  const serviceUuid = getClientId();
  const url = `${baseUrl}/auth/realms/${tenant}/mpower/v1/users/${encodeURIComponent(
    input.userId,
  )}/message`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      serviceUuid,
      messageType: "processChatMessage",
      version: 3,
      messageContent: {
        messageText: input.messageText,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`mPower chat message failed with status ${response.status}`);
  }

  return (await response.json()) as MpowerSendResult;
}

export async function sendSignatureRequest(input: {
  callbackUrl: string;
  fileName: string;
  messageText: string;
  pdf: Uint8Array;
  signaturePageNumber: number;
  userId: string;
}) {
  const token = await getMpowerToken();
  const baseUrl = requireEnv("MPOWER_BASE_URL").replace(/\/$/, "");
  const tenant = requireEnv("MPOWER_TENANT");
  const serviceUuid = getClientId();
  const url = `${baseUrl}/auth/realms/${tenant}/mpower/v1/users/${encodeURIComponent(
    input.userId,
  )}/signature`;

  const formData = new FormData();
  const pdfArrayBuffer = new ArrayBuffer(input.pdf.byteLength);
  new Uint8Array(pdfArrayBuffer).set(input.pdf);
  const pdfBlob = new Blob([pdfArrayBuffer], { type: "application/pdf" });
  formData.append("signatureFile", pdfBlob, input.fileName);
  formData.append(
    "signatureData",
    JSON.stringify({
      version: 3,
      pageNumber: input.signaturePageNumber,
      bottomLeftXCoordinate: 8,
      bottomLeftYCoordinate: 6,
      topRightXCoordinate: 52,
      topRightYCoordinate: 16,
      serviceUuid,
      messageText: input.messageText,
      callbackUrl: input.callbackUrl,
    }),
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `mPower signature request failed with status ${response.status}${
        detail ? `: ${detail.slice(0, 240)}` : ""
      }`,
    );
  }

  return (await response.json()) as MpowerSignatureResult;
}

export async function downloadMpowerMedia(mediaId: string) {
  const token = await getMpowerToken();
  const baseUrl = requireEnv("MPOWER_BASE_URL").replace(/\/$/, "");
  const tenant = requireEnv("MPOWER_TENANT");
  const url = `${baseUrl}/v1/mpower/tenants/${encodeURIComponent(
    tenant,
  )}/media/${encodeURIComponent(mediaId)}/download`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`mPower media download failed with status ${response.status}`);
  }

  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "application/pdf",
  };
}

async function getMpowerToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const issuer = requireEnv("OIDC_ISSUER").replace(/\/$/, "");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: getClientId(),
    client_secret: requireEnv("OIDC_CLIENT_SECRET"),
  });
  const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`mPower token request failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new Error("mPower token response did not include access_token");
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 300) * 1000,
  };

  return cachedToken.accessToken;
}

function getClientId() {
  return process.env.MPOWER_SERVICE_UUID ?? process.env.OIDC_CLIENT_ID ?? "";
}

function requireEnv(key: string) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is required for mPower integration`);
  }

  return value;
}
