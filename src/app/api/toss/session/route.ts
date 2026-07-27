import { NextRequest, NextResponse } from "next/server";
import { getTossProfile, refreshTossTokens, removeTossAccess, decryptTossProfile } from "@/lib/toss-login";
import { makeSession, openSession, sealSession, sessionCookieOptions, TOSS_SESSION_COOKIE } from "@/lib/toss-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isConfigured() {
  return Boolean(
    process.env.TOSS_MTLS_CERT &&
    process.env.TOSS_MTLS_KEY &&
    process.env.TOSS_DECRYPTION_KEY &&
    process.env.TOSS_DECRYPTION_AAD &&
    process.env.TOSS_SESSION_SECRET,
  );
}

export async function GET(req: NextRequest) {
  const session = openSession(req.cookies.get(TOSS_SESSION_COOKIE)?.value || "");
  if (!session) return NextResponse.json({ profile: null, configured: isConfigured() });
  try {
    if (session.accessExpiresAt > Date.now() + 60_000) return NextResponse.json({ profile: session.profile, configured: true });
    const tokens = await refreshTossTokens(session.refreshToken);
    const profile = decryptTossProfile(await getTossProfile(tokens.accessToken));
    const response = NextResponse.json({ profile, configured: true });
    response.cookies.set(TOSS_SESSION_COOKIE, sealSession(makeSession(profile, tokens)), sessionCookieOptions);
    return response;
  } catch (error) {
    console.error("[toss/session] refresh failed", error);
    const response = NextResponse.json({ profile: null, configured: isConfigured() }, { status: 401 });
    response.cookies.set(TOSS_SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
    return response;
  }
}

export async function DELETE(req: NextRequest) {
  const session = openSession(req.cookies.get(TOSS_SESSION_COOKIE)?.value || "");
  if (session) {
    try { await removeTossAccess(session.accessToken); }
    catch (error) { console.warn("[toss/session] remote unlink failed", error); }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(TOSS_SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
