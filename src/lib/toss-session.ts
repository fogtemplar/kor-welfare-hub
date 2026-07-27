import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { TossProfile, TossTokens } from "./toss-login";

export const TOSS_SESSION_COOKIE = "welfare_toss_session";

export type TossSession = {
  profile: TossProfile;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
};

function sessionKey() {
  const secret = process.env.TOSS_SESSION_SECRET?.trim();
  if (!secret) throw new Error("TOSS_SESSION_NOT_CONFIGURED");
  const key = Buffer.from(secret, "base64");
  if (key.length !== 32) throw new Error("TOSS_SESSION_SECRET_INVALID");
  return key;
}

export function sealSession(session: TossSession) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function openSession(value: string): TossSession | null {
  try {
    const data = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", sessionKey(), data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
    return JSON.parse(plain) as TossSession;
  } catch {
    return null;
  }
}

export function makeSession(profile: TossProfile, tokens: TossTokens): TossSession {
  return {
    profile,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessExpiresAt: Date.now() + Math.max(60, Number(tokens.expiresIn)) * 1000,
  };
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
  path: "/api/toss",
  maxAge: 14 * 24 * 60 * 60,
};
