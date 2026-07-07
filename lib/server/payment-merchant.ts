type MerchantToken = {
  accessToken: string;
  expiresAt: number;
};

type CreateTransactionResult = {
  deepLink?: string | null;
  paymentUrl?: string | null;
  rawKeys: string[];
  redirectUrl?: string | null;
  transactionId: string;
  status: string;
};

let cachedToken: MerchantToken | null = null;

export function hasPaymentMerchantConfig() {
  return Boolean(
    process.env.OIDC_ISSUER &&
      process.env.PAYMENT_BASE_URL &&
      process.env.PAYMENT_MERCHANT_ID &&
      process.env.PAYMENT_MERCHANT_SECRET &&
      process.env.PAYMENT_TENANT_ID,
  );
}

export function hasDedicatedPaymentMerchantConfig() {
  return Boolean(hasPaymentMerchantConfig() && process.env.PAYMENT_MERCHANT_ID !== process.env.OIDC_CLIENT_ID);
}

/**
 * Creates an mPower payment transaction via the dedicated merchant client.
 * This is a SEPARATE client from the MiniApp's OIDC client (even when, as in
 * a dev tenant, the credentials happen to match) - see mPower payment docs.
 *
 * Important: this only demonstrates the platform payment rail. The funds
 * land in this MiniApp's own merchant wallet, NOT the real German authority
 * - we are not a licensed payment intermediary for Finanzamt/Jobcenter/etc.
 * The UI must label this clearly as a demo, distinct from the real IBAN
 * bank-transfer flow we show as the actual way to pay the authority.
 */
export async function createPaymentTransaction(input: {
  amountCents: number;
  currency?: string;
  idempotencyId: string;
  merchantCallback: string;
  merchantName: string;
  paymentContent: Array<{ key: string; value: string }>;
  userId: string;
}): Promise<CreateTransactionResult> {
  const token = await getMerchantToken();
  const baseUrl = requireEnv("PAYMENT_BASE_URL").replace(/\/$/, "");
  const merchantId = requireEnv("PAYMENT_MERCHANT_ID");
  const tenantId = requireEnv("PAYMENT_TENANT_ID");

  const response = await fetch(`${baseUrl}/mpay-merchant/create/transaction`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: 1,
      idempotencyId: input.idempotencyId,
      userId: input.userId,
      merchantId,
      merchantServiceUUID: merchantId,
      merchantName: input.merchantName,
      merchantCallback: input.merchantCallback,
      transactionTimeout: 10,
      amount: input.amountCents,
      tenantId,
      currency: input.currency ?? "EUR",
      paymentContent: [input.paymentContent],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `mPower payment transaction failed with status ${response.status}${
        detail ? `: ${detail.slice(0, 240)}` : ""
      }`,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  const transactionId = getString(data.transactionId);

  if (!transactionId) {
    throw new Error(
      `mPower payment response did not include transactionId. Response keys: ${Object.keys(data).join(", ") || "none"}`,
    );
  }

  const paymentUrl = firstString(data, [
    "paymentUrl",
    "paymentLink",
    "url",
    "checkoutUrl",
  ]);
  const redirectUrl = firstString(data, [
    "redirectUrl",
    "redirectUri",
    "redirectURL",
  ]);
  const deepLink = firstString(data, ["deepLink", "deeplink", "paymentDeepLink"]);
  const rawKeys = Object.keys(data);

  console.log(
    `AmtBrief: payment transaction created transactionId=${transactionId} status=${getString(data.status) ?? "new"} hasPaymentUrl=${Boolean(paymentUrl)} hasRedirectUrl=${Boolean(redirectUrl)} hasDeepLink=${Boolean(deepLink)} responseKeys=${rawKeys.join(",") || "none"}`,
  );

  return {
    deepLink,
    paymentUrl,
    rawKeys,
    redirectUrl,
    transactionId,
    status: getString(data.status) ?? "new",
  };
}

export function isPaymentFinished(status: string | undefined | null) {
  const normalized = (status ?? "").toLowerCase();
  return normalized.includes("finished") || normalized.includes("complete");
}

async function getMerchantToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const issuer = requireEnv("OIDC_ISSUER").replace(/\/$/, "");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: requireEnv("PAYMENT_MERCHANT_ID"),
    client_secret: requireEnv("PAYMENT_MERCHANT_SECRET"),
  });

  const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Payment merchant token request failed with status ${response.status}${formatDetail(detail)}`,
    );
  }

  const data = (await response.json()) as { access_token?: string; expires_in?: number };

  if (!data.access_token) {
    throw new Error("Payment merchant token response did not include access_token");
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 300) * 1000,
  };

  return cachedToken.accessToken;
}

function requireEnv(key: string) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is required for mPower payment integration`);
  }

  return value;
}

function formatDetail(detail: string) {
  return detail ? `: ${detail.slice(0, 240)}` : "";
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function firstString(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = getString(data[key]);
    if (value) return value;
  }

  return null;
}
