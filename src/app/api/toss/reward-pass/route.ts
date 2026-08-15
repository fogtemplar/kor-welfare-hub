import { NextRequest, NextResponse } from "next/server";
import { getRewardPassState, isRewardPassConfigured, issueRewardPass, prepareRewardChallenge } from "@/lib/reward-pass";
import { openSession, TOSS_SESSION_COOKIE } from "@/lib/toss-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sessionFrom(request: NextRequest) {
  return openSession(request.cookies.get(TOSS_SESSION_COOKIE)?.value || "");
}

export async function GET(request: NextRequest) {
  const session = sessionFrom(request);
  if (!session) return NextResponse.json({ error: "TOSS_LOGIN_REQUIRED" }, { status: 401 });
  if (!isRewardPassConfigured()) return NextResponse.json({ configured: false, status: "unavailable" }, { status: 503 });
  try {
    const state = await getRewardPassState(session.profile.userKey);
    return NextResponse.json({ configured: true, status: state?.status || "available", token: state?.status === "issued" ? state.token : undefined }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[toss/reward-pass] status failed", error);
    return NextResponse.json({ error: "REWARD_STATUS_FAILED" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = sessionFrom(request);
  if (!session) return NextResponse.json({ error: "TOSS_LOGIN_REQUIRED" }, { status: 401 });
  if (!isRewardPassConfigured()) return NextResponse.json({ error: "REWARD_STORE_NOT_CONFIGURED" }, { status: 503 });

  let body: { action?: string; challenge?: string };
  try { body = await request.json() as { action?: string; challenge?: string }; }
  catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }); }

  try {
    if (body.action === "prepare") {
      const result = await prepareRewardChallenge(session.profile.userKey);
      return NextResponse.json({ status: result.state?.status || "available", token: result.state?.status === "issued" ? result.state.token : undefined, challenge: result.challenge });
    }
    if (body.action === "claim" && typeof body.challenge === "string" && body.challenge.length >= 24) {
      const state = await issueRewardPass(session.profile.userKey, body.challenge);
      return NextResponse.json({ status: state.status, token: state.status === "issued" ? state.token : undefined });
    }
    return NextResponse.json({ error: "INVALID_REWARD_REQUEST" }, { status: 400 });
  } catch (error) {
    console.error("[toss/reward-pass] mutation failed", error);
    return NextResponse.json({ error: "REWARD_PASS_FAILED" }, { status: 409 });
  }
}
