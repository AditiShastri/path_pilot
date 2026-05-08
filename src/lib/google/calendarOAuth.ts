import "server-only";

import crypto from "crypto";

// Write access is required for creating calendar events.
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function base64UrlEncode(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBase64(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  return normalized + (pad === 0 ? "" : "=".repeat(4 - pad));
}

function base64UrlDecodeToBuffer(input: string) {
  return Buffer.from(base64UrlToBase64(input), "base64");
}

function base64UrlDecodeToString(input: string) {
  return base64UrlDecodeToBuffer(input).toString("utf8");
}

export type CalendarOAuthTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

export function getGoogleOAuthConfig() {
  return {
    clientId: requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri: requireEnv("GOOGLE_REDIRECT_URI"),
  };
}

export function createSignedState(payload: { userId: string }) {
  const secret = requireEnv("GOOGLE_CLIENT_SECRET");
  const statePayload = {
    v: 1,
    userId: payload.userId,
    nonce: crypto.randomBytes(16).toString("hex"),
    iat: Date.now(),
  };

  const raw = JSON.stringify(statePayload);
  const sig = crypto.createHmac("sha256", secret).update(raw).digest();

  return `${base64UrlEncode(raw)}.${base64UrlEncode(sig)}`;
}

export function verifySignedState(state: string): { userId: string } {
  const secret = requireEnv("GOOGLE_CLIENT_SECRET");
  const [payloadB64, sigB64] = state.split(".");
  if (!payloadB64 || !sigB64) throw new Error("Invalid OAuth state");

  const raw = base64UrlDecodeToString(payloadB64);
  const expectedSig = crypto.createHmac("sha256", secret).update(raw).digest();
  const actualSig = base64UrlDecodeToBuffer(sigB64);

  // Constant-time compare
  if (actualSig.length !== expectedSig.length || !crypto.timingSafeEqual(actualSig, expectedSig)) {
    throw new Error("Invalid OAuth state signature");
  }

  const parsed = JSON.parse(raw) as { userId: string; iat: number; v: number };
  if (!parsed?.userId) throw new Error("Invalid OAuth state payload");

  // 10 minute max age
  if (typeof parsed.iat === "number" && Date.now() - parsed.iat > 10 * 60 * 1000) {
    throw new Error("OAuth state expired");
  }

  return { userId: parsed.userId };
}

export function createCalendarPermissionUrl(options: { userId: string }) {
  const { clientId, redirectUri } = getGoogleOAuthConfig();

  const state = createSignedState({ userId: options.userId });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", CALENDAR_SCOPE);
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  return url.toString();
}

export async function exchangeCodeForTokens(code: string): Promise<CalendarOAuthTokens> {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  const json = (await res.json()) as any;
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${json?.error ?? res.statusText}`);
  }

  if (!json.access_token) throw new Error("Missing access_token from Google");

  return json as CalendarOAuthTokens;
}

export async function refreshAccessToken(refreshToken: string): Promise<CalendarOAuthTokens> {
  const { clientId, clientSecret } = getGoogleOAuthConfig();

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  const json = (await res.json()) as any;
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${json?.error ?? res.statusText}`);
  }

  if (!json.access_token) throw new Error("Missing access_token from Google refresh");

  return json as CalendarOAuthTokens;
}
