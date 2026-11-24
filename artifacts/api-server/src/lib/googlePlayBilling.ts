import { createHash, createSign } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_PUBLISHER_API = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const GOOGLE_PLAY_SCOPE = "https://www.googleapis.com/auth/androidpublisher";

type GooglePlayConfig = {
  packageName: string;
  serviceAccountEmail: string;
  privateKey: string;
};

export type GoogleProductPurchase = {
  purchaseState?: number;
  consumptionState?: number;
  acknowledgementState?: number;
  orderId?: string;
  productId?: string;
  purchaseToken?: string;
  quantity?: number;
  obfuscatedExternalAccountId?: string;
};

export type GoogleSubscriptionPurchase = {
  subscriptionState?: string;
  acknowledgementState?: string;
  latestOrderId?: string;
  externalAccountIdentifiers?: {
    obfuscatedExternalAccountId?: string;
  };
  lineItems?: Array<{
    productId?: string;
    expiryTime?: string;
    offerDetails?: {
      basePlanId?: string;
      offerId?: string;
    };
  }>;
};

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

export const googlePlaySchemaReady = db.execute(sql`
  CREATE TABLE IF NOT EXISTS google_play_purchases (
    purchase_token text PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id text NOT NULL,
    purchase_type text NOT NULL CHECK (purchase_type IN ('coin_pack', 'subscription')),
    status text NOT NULL,
    order_id text,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`).then(() => db.execute(sql`
  CREATE INDEX IF NOT EXISTS google_play_purchases_user_status_idx
  ON google_play_purchases (user_id, purchase_type, updated_at DESC)
`));

export async function getActiveGooglePlayProductIds(userId: number) {
  await googlePlaySchemaReady;
  const result = await db.execute(sql`
    SELECT DISTINCT product_id
    FROM google_play_purchases
    WHERE user_id = ${userId}
      AND purchase_type = 'subscription'
      AND status = 'active'
      AND expires_at > now()
  `);
  return result.rows.map((row) => String(row.product_id));
}

export function getGooglePlayConfig(): GooglePlayConfig | null {
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim() ?? "";
  const serviceAccountEmail = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL?.trim() ?? "";
  const privateKey = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n").trim() ?? "";
  if (packageName !== "com.loopsocial.app"
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(serviceAccountEmail)
    || !privateKey.includes("-----BEGIN PRIVATE KEY-----")) return null;
  return { packageName, serviceAccountEmail, privateKey };
}

export function isGooglePlayBillingReady() {
  return getGooglePlayConfig() !== null;
}

export function getGooglePlayAccountId(userId: number) {
  return createHash("sha256").update(`loop:${userId}`).digest("hex");
}

export function getGooglePlayPurchaseReferenceId(purchaseToken: string) {
  return `google-play:${createHash("sha256").update(purchaseToken).digest("hex")}`;
}

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

async function createGoogleAccessToken(config: GooglePlayConfig) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: config.serviceAccountEmail,
    scope: GOOGLE_PLAY_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsignedToken = `${toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${toBase64Url(JSON.stringify(claims))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const assertion = `${unsignedToken}.${signer.sign(config.privateKey, "base64url")}`;
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const result = await response.json() as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !result.access_token) {
    throw new Error(`Google OAuth token request failed (${response.status}${result.error ? `: ${result.error}` : ""})`);
  }
  cachedAccessToken = {
    value: result.access_token,
    expiresAt: Date.now() + Math.max(60, (result.expires_in ?? 3600) - 60) * 1000,
  };
  return result.access_token;
}

async function getGoogleAccessToken(config: GooglePlayConfig) {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) return cachedAccessToken.value;
  return createGoogleAccessToken(config);
}

async function googlePlayRequest<T>(
  route: string,
  method: "GET" | "POST" = "GET",
  requestBody?: Record<string, never>,
): Promise<T> {
  const config = getGooglePlayConfig();
  if (!config) throw new Error("Google Play Billing server credentials are not configured");
  const accessToken = await getGoogleAccessToken(config);
  const response = await fetch(`${GOOGLE_PUBLISHER_API}/applications/${encodeURIComponent(config.packageName)}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(requestBody ? { "Content-Type": "application/json" } : {}),
    },
    ...(requestBody ? { body: JSON.stringify(requestBody) } : {}),
  });
  if (!response.ok) {
    cachedAccessToken = null;
    throw new Error(`Google Play Developer API request failed (${response.status})`);
  }
  const body = await response.text();
  if (!body) return undefined as T;
  return JSON.parse(body) as T;
}

export async function getGoogleProductPurchase(productId: string, purchaseToken: string) {
  return googlePlayRequest<GoogleProductPurchase>(
    `/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`,
  );
}

export async function consumeGoogleProductPurchase(productId: string, purchaseToken: string) {
  return googlePlayRequest<void>(
    `/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:consume`,
    "POST",
  );
}

export async function getGoogleSubscriptionPurchase(purchaseToken: string) {
  return googlePlayRequest<GoogleSubscriptionPurchase>(
    `/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
  );
}

export async function acknowledgeGoogleSubscription(subscriptionId: string, purchaseToken: string) {
  return googlePlayRequest<void>(
    `/purchases/subscriptions/${encodeURIComponent(subscriptionId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
    "POST",
    {},
  );
}
