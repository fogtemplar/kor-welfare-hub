import { NextResponse } from "next/server";
import { decryptTossProfile, generateTossTokens, getTossProfile } from "@/lib/toss-login";
import { makeSession, sealSession, sessionCookieOptions, TOSS_SESSION_COOKIE } from "@/lib/toss-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json() as { authorizationCode?: string; referrer?: string };
    if (!body.authorizationCode || !["DEFAULT", "SANDBOX"].includes(body.referrer || "")) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    const tokens = await generateTossTokens(body.authorizationCode, body.referrer as "DEFAULT" | "SANDBOX");
    const profile = decryptTossProfile(await getTossProfile(tokens.accessToken));
    const response = NextResponse.json({ profile });
    response.cookies.set(TOSS_SESSION_COOKIE, sealSession(makeSession(profile, tokens)), sessionCookieOptions);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    console.error("[toss/login]", message);
    const status = message.includes("NOT_CONFIGURED") ? 503 : 502;
    return NextResponse.json({ error: message.split(":")[0] }, { status });
  }
}
