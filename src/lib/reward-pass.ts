import { randomBytes } from "node:crypto";

export type RewardPassState = {
  status: "issued" | "consumed";
  token: string;
  issuedAt: string;
  consumedAt?: string;
  challenge?: string;
};

const PASS_TTL_SECONDS = 365 * 24 * 60 * 60;
const CHALLENGE_TTL_SECONDS = 10 * 60;

function config() {
  const url = (process.env.REPORT_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)?.replace(/\/$/, "");
  const token = process.env.REPORT_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

async function command(args: Array<string | number>) {
  const redis = config();
  if (!redis) throw new Error("REWARD_STORE_NOT_CONFIGURED");
  const response = await fetch(redis.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${redis.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`REWARD_STORE_${response.status}`);
  return (await response.json() as { result?: unknown }).result;
}

const userKey = (userKey: number) => `welfare:reward-pass:user:${userKey}`;
const tokenKey = (token: string) => `welfare:reward-pass:token:${token}`;
const challengeKey = (userKey: number, challenge: string) => `welfare:reward-pass:challenge:${userKey}:${challenge}`;

export function isRewardPassConfigured() {
  return Boolean(config());
}

export async function getRewardPassState(userId: number): Promise<RewardPassState | null> {
  const value = await command(["GET", userKey(userId)]);
  if (typeof value !== "string") return null;
  try { return JSON.parse(value) as RewardPassState; }
  catch { return null; }
}

export async function prepareRewardChallenge(userId: number) {
  const existing = await getRewardPassState(userId);
  if (existing) return { state: existing, challenge: null };
  const challenge = randomBytes(24).toString("base64url");
  await command(["SET", challengeKey(userId, challenge), "1", "EX", CHALLENGE_TTL_SECONDS, "NX"]);
  return { state: null, challenge };
}

export async function issueRewardPass(userId: number, challenge: string) {
  const key = challengeKey(userId, challenge);
  const proof = await command(["GET", key]);
  if (proof !== "1") throw new Error("REWARD_CHALLENGE_INVALID");
  await command(["DEL", key]);

  const existing = await getRewardPassState(userId);
  if (existing) return existing;

  const token = randomBytes(24).toString("base64url");
  const state: RewardPassState = { status: "issued", token, issuedAt: new Date().toISOString(), challenge };
  const created = await command(["SET", userKey(userId), JSON.stringify(state), "EX", PASS_TTL_SECONDS, "NX"]);
  if (created !== "OK") {
    const raced = await getRewardPassState(userId);
    if (raced) return raced;
    throw new Error("REWARD_PASS_CREATE_FAILED");
  }
  await command(["SET", tokenKey(token), String(userId), "EX", PASS_TTL_SECONDS]);
  return state;
}

export async function verifyRewardChallenge(userId: number, challenge: string) {
  return await command(["GET", challengeKey(userId, challenge)]) === "1";
}

export async function verifyRewardPass(userId: number, token: string) {
  const owner = await command(["GET", tokenKey(token)]);
  const state = await getRewardPassState(userId);
  return owner === String(userId) && state?.token === token ? state : null;
}

export async function consumeRewardPass(userId: number, token: string) {
  const state = await verifyRewardPass(userId, token);
  if (!state || state.status !== "issued") return false;
  const consumed: RewardPassState = { ...state, status: "consumed", consumedAt: new Date().toISOString() };
  await command(["SET", userKey(userId), JSON.stringify(consumed), "EX", PASS_TTL_SECONDS, "XX"]);
  return true;
}
