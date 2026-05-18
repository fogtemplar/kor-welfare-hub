import { NextResponse } from "next/server";
import { CURATED_POLICIES } from "@/lib/data/policies";
import { fetchExternalPolicies } from "@/lib/scrapers/aggregate";
import { recommend } from "@/lib/ai/gemini";
import type { Policy } from "@/lib/types";

export const runtime = "nodejs";

// 간단한 IP별 rate limit (메모리 기반, 단일 인스턴스 환경 가정)
const requestLog = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1시간
const RATE_LIMIT_MAX = 10; // IP당 시간당 10회

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const arr = (requestLog.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (arr.length >= RATE_LIMIT_MAX) {
    requestLog.set(ip, arr);
    return false;
  }
  arr.push(now);
  requestLog.set(ip, arr);
  return true;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "anon";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. 시간당 10회 한도 초과." },
      { status: 429 },
    );
  }

  let userText: string;
  try {
    const body = await req.json();
    userText = String(body?.text ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!userText || userText.length < 5) {
    return NextResponse.json(
      { error: "최소 5자 이상 입력해주세요." },
      { status: 400 },
    );
  }
  if (userText.length > 1000) {
    return NextResponse.json(
      { error: "1000자 이내로 입력해주세요." },
      { status: 400 },
    );
  }

  // 민감 정보 패턴 차단 (주민등록번호 풀번호)
  if (/\d{6}\s*-\s*[1-4]\d{6}/.test(userText)) {
    return NextResponse.json(
      { error: "주민등록번호 등 민감정보는 입력하지 마세요. 나이·성별만 적어주세요." },
      { status: 400 },
    );
  }

  try {
    const external = await fetchExternalPolicies();
    const allPolicies: Policy[] = [...CURATED_POLICIES, ...external];

    const result = await recommend(userText, allPolicies);

    // policyId를 실제 Policy로 매핑
    const policyMap = new Map(allPolicies.map((p) => [p.id, p]));
    const recommendations = result.picks
      .map((pick) => {
        const policy = policyMap.get(pick.policyId);
        return policy ? { ...policy, aiReason: pick.reason } : null;
      })
      .filter((x): x is Policy & { aiReason: string } => x !== null);

    return NextResponse.json({
      profile: result.profile,
      summary: result.summary,
      followUp: result.followUp,
      recommendations,
    });
  } catch (e: any) {
    console.error("[ai/recommend] failed:", e);
    return NextResponse.json(
      { error: "AI 추천 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
