import { createHash, createHmac, randomBytes, timingSafeEqual, verify } from "crypto";

export type UserSession = {
  email?: string;
  familyName?: string;
  givenName?: string;
  name?: string;
  preferredUsername?: string;
  sub: string;
};

type JwtHeader = {
  alg?: string;
  kid?: string;
};

type JwtPayload = {
  aud?: string | string[];
  email?: string;
  exp?: number;
  family_name?: string;
  given_name?: string;
  iss?: string;
  name?: string;
  nonce?: string;
  preferred_username?: string;
  sub?: string;
};

type Jwk = {
  alg?: string;
  e: string;
  kid: string;
  kty: "RSA";
  n: string;
  use?: string;
};

type Jwks = {
  keys?: Jwk[];
};

export function isOidcEnabled() {
  return Boolean(
    process.env.OIDC_ISSUER &&
      process.env.OIDC_CLIENT_ID &&
      process.env.OIDC_CLIENT_SECRET &&
      process.env.APP_BASE_URL,
  );
}

export function createPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { challenge, verifier };
}

export function createOidcAuthUrl(input: {
  challenge: string;
  nonce: string;
  state: string;
}) {
  const issuer = requireEnv("OIDC_ISSUER").replace(/\/$/, "");
  const params = new URLSearchParams({
    client_id: requireEnv("OIDC_CLIENT_ID"),
    code_challenge: input.challenge,
    code_challenge_method: "S256",
    nonce: input.nonce,
    redirect_uri: `${requireEnv("APP_BASE_URL").replace(/\/$/, "")}/api/auth/callback`,
    response_type: "code",
    scope: "openid profile email",
    state: input.state,
  });

  return `${issuer}/protocol/openid-connect/auth?${params.toString()}`;
}

export async function exchangeOidcCode(input: {
  code: string;
  verifier: string;
}) {
  const issuer = requireEnv("OIDC_ISSUER").replace(/\/$/, "");
  const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: requireEnv("OIDC_CLIENT_ID"),
      client_secret: requireEnv("OIDC_CLIENT_SECRET"),
      code: input.code,
      code_verifier: input.verifier,
      grant_type: "authorization_code",
      redirect_uri: `${requireEnv("APP_BASE_URL").replace(/\/$/, "")}/api/auth/callback`,
    }),
  });

  if (!response.ok) {
    throw new Error(`OIDC token exchange failed with status ${response.status}`);
  }

  return (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    id_token?: string;
  };
}

export async function verifyIdToken(idToken: string, expectedNonce: string) {
  const [encodedHeader, encodedPayload, encodedSignature] = idToken.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Invalid id_token format");
  }

  const header = decodeJwtPart<JwtHeader>(encodedHeader);
  const payload = decodeJwtPart<JwtPayload>(encodedPayload);

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Unsupported id_token header");
  }

  const jwk = await getJwk(header.kid);
  const publicKey = { key: jwk, format: "jwk" as const };
  const verified = verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    Buffer.from(encodedSignature, "base64url"),
  );

  if (!verified) {
    throw new Error("Invalid id_token signature");
  }

  const issuer = requireEnv("OIDC_ISSUER").replace(/\/$/, "");
  const clientId = requireEnv("OIDC_CLIENT_ID");
  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud ?? ""];

  if (payload.iss !== issuer || !audience.includes(clientId)) {
    throw new Error("Invalid id_token issuer or audience");
  }

  if (payload.nonce !== expectedNonce) {
    throw new Error("Invalid id_token nonce");
  }

  if (!payload.exp || payload.exp * 1000 <= Date.now()) {
    throw new Error("Expired id_token");
  }

  if (!payload.sub) {
    throw new Error("id_token does not include sub");
  }

  return {
    email: payload.email,
    familyName: payload.family_name,
    givenName: payload.given_name,
    name: payload.name,
    preferredUsername: payload.preferred_username,
    sub: payload.sub,
  } satisfies UserSession;
}

export function signUserSession(session: UserSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = createSessionSignature(payload);
  return `${payload}.${signature}`;
}

export function verifyUserSession(value: string | undefined): UserSession | null {
  if (!value) return null;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = createSessionSignature(payload);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as UserSession;
    return parsed.sub ? parsed : null;
  } catch {
    return null;
  }
}

function createSessionSignature(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET ?? "dev-session-secret-change-before-production";
}

async function getJwk(kid: string) {
  const issuer = requireEnv("OIDC_ISSUER").replace(/\/$/, "");
  const response = await fetch(`${issuer}/protocol/openid-connect/certs`, {
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`JWKS request failed with status ${response.status}`);
  }

  const jwks = (await response.json()) as Jwks;
  const jwk = jwks.keys?.find((key) => key.kid === kid);

  if (!jwk) {
    throw new Error("Matching JWKS key not found");
  }

  return jwk;
}

function decodeJwtPart<T>(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function requireEnv(key: string) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is required for OIDC`);
  }

  return value;
}
