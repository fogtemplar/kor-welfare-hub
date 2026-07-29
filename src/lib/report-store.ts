import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

type StoredReportEnvelope = {
  orderId: string;
  createdAt: string;
  report: unknown;
};

const REPORT_TTL_SECONDS = 90 * 24 * 60 * 60;

function config() {
  const url = (process.env.REPORT_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)?.replace(/\/$/, "");
  const token = process.env.REPORT_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

function encryptionKey() {
  const value = process.env.REPORT_ENCRYPTION_KEY || process.env.TOSS_SESSION_SECRET;
  if (!value) throw new Error("REPORT_ENCRYPTION_NOT_CONFIGURED");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("REPORT_ENCRYPTION_KEY_INVALID");
  return key;
}

function seal(value: StoredReportEnvelope) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function open(value: string): StoredReportEnvelope | null {
  try {
    const data = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8")) as StoredReportEnvelope;
  } catch {
    return null;
  }
}

async function command(args: Array<string | number>) {
  const redis = config();
  if (!redis) return null;
  const response = await fetch(redis.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${redis.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`REPORT_STORE_${response.status}`);
  return (await response.json() as { result?: unknown }).result;
}

export function isReportStoreConfigured() {
  return Boolean(config());
}

export async function saveUserReport(userKey: number, value: StoredReportEnvelope) {
  if (!config()) return false;
  const encoded = seal(value);
  await command(["SET", `welfare:report:user:${userKey}:latest`, encoded, "EX", REPORT_TTL_SECONDS]);
  await command(["SET", `welfare:report:order:${value.orderId}`, String(userKey), "EX", REPORT_TTL_SECONDS]);
  return true;
}

export async function getLatestUserReport(userKey: number) {
  const result = await command(["GET", `welfare:report:user:${userKey}:latest`]);
  return typeof result === "string" ? open(result) : null;
}
