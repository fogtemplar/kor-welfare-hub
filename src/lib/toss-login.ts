import { createDecipheriv } from "node:crypto";
import { request } from "node:https";

const BASE_URL = "https://apps-in-toss-api.toss.im";

type TossSuccess<T> = { resultType: "SUCCESS"; success: T };
type TossFailure = { resultType?: "FAIL"; error?: { errorCode?: string; reason?: string } | string };

export type TossTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  tokenType: string;
};

export type TossProfile = {
  userKey: number;
  scope: string;
  agreedTerms: string[];
  name?: string | null;
  phone?: string | null;
  birthday?: string | null;
  gender?: string | null;
  nationality?: string | null;
  email?: string | null;
};

function certificate(value: string | undefined) {
  return value?.replace(/\\n/g, "\n").trim();
}

function tossRequest<T>(path: string, method: "GET" | "POST", body?: unknown, accessToken?: string): Promise<T> {
  const cert = certificate(process.env.TOSS_MTLS_CERT);
  const key = certificate(process.env.TOSS_MTLS_KEY);
  if (!cert || !key) throw new Error("TOSS_LOGIN_NOT_CONFIGURED");

  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = request(`${BASE_URL}${path}`, {
      method,
      cert,
      key,
      passphrase: process.env.TOSS_MTLS_PASSPHRASE || undefined,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      timeout: 10_000,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let parsed: TossSuccess<T> | TossFailure;
        try { parsed = JSON.parse(raw) as TossSuccess<T> | TossFailure; }
        catch { return reject(new Error(`TOSS_INVALID_RESPONSE:${response.statusCode ?? 0}`)); }
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300 && parsed.resultType === "SUCCESS") {
          return resolve(parsed.success);
        }
        const failure = parsed as TossFailure;
        const reason = typeof failure.error === "string" ? failure.error : failure.error?.errorCode || failure.error?.reason;
        reject(new Error(`TOSS_API_ERROR:${reason || response.statusCode || "UNKNOWN"}`));
      });
    });
    req.on("timeout", () => req.destroy(new Error("TOSS_API_TIMEOUT")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export function generateTossTokens(authorizationCode: string, referrer: "DEFAULT" | "SANDBOX") {
  return tossRequest<TossTokens>("/api-partner/v1/apps-in-toss/user/oauth2/generate-token", "POST", { authorizationCode, referrer });
}

export function refreshTossTokens(refreshToken: string) {
  return tossRequest<TossTokens>("/api-partner/v1/apps-in-toss/user/oauth2/refresh-token", "POST", { refreshToken });
}

export function getTossProfile(accessToken: string) {
  return tossRequest<TossProfile>("/api-partner/v1/apps-in-toss/user/oauth2/login-me", "GET", undefined, accessToken);
}

export function removeTossAccess(accessToken: string) {
  return tossRequest<{ userKey?: number }>("/api-partner/v1/apps-in-toss/user/oauth2/access/remove-by-access-token", "POST", undefined, accessToken);
}

export function decryptTossProfile(profile: TossProfile): TossProfile {
  const keyText = process.env.TOSS_DECRYPTION_KEY?.trim();
  const aad = process.env.TOSS_DECRYPTION_AAD;
  if (!keyText || !aad) throw new Error("TOSS_DECRYPTION_NOT_CONFIGURED");
  const key = Buffer.from(keyText, "base64");
  if (key.length !== 32) throw new Error("TOSS_DECRYPTION_KEY_INVALID");

  const decrypt = (value?: string | null) => {
    if (!value) return value;
    const data = Buffer.from(value, "base64");
    if (data.length < 29) throw new Error("TOSS_ENCRYPTED_VALUE_INVALID");
    const iv = data.subarray(0, 12);
    const tag = data.subarray(data.length - 16);
    const encrypted = data.subarray(12, data.length - 16);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  };

  return {
    ...profile,
    name: decrypt(profile.name),
    phone: decrypt(profile.phone),
    birthday: decrypt(profile.birthday),
    gender: decrypt(profile.gender),
    nationality: decrypt(profile.nationality),
    email: decrypt(profile.email),
  };
}
