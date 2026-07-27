import { NextResponse } from "next/server";
import { CURATED_POLICIES } from "@/lib/data/policies";
import { fetchExternalPolicies } from "@/lib/scrapers/aggregate";
import { recommend, SafetyBlockedError } from "@/lib/ai/gemini";
import type { Policy } from "@/lib/types";

export const runtime = "nodejs";

// rate limit (메모리 기반).
// 주의: 서버리스는 인스턴스마다 메모리가 따로라 IP별 한도는 인스턴스 수만큼
// 늘어난다. 완전한 방어가 아니므로, 인스턴스별 총량 상한(GLOBAL_MAX)을
// 함께 두어 최악의 경우 청구액을 유한하게 묶는다.
// 정확한 전역 제한이 필요하면 Upstash Redis 등 외부 저장소로 옮길 것.
const requestLog = new Map<string, number[]>();
const globalLog: number[] = [];
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1시간
const RATE_LIMIT_MAX = Number(process.env.AI_RATE_LIMIT_PER_IP ?? 10);
const GLOBAL_MAX = Number(process.env.AI_RATE_LIMIT_GLOBAL ?? 300);

function prune(arr: number[], now: number): number[] {
  return arr.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
}

function checkRateLimit(ip: string): "ok" | "ip" | "global" {
  const now = Date.now();

  const g = prune(globalLog, now);
  globalLog.length = 0;
  globalLog.push(...g);
  if (g.length >= GLOBAL_MAX) return "global";

  const arr = prune(requestLog.get(ip) ?? [], now);
  if (arr.length >= RATE_LIMIT_MAX) {
    requestLog.set(ip, arr);
    return "ip";
  }
  arr.push(now);
  requestLog.set(ip, arr);
  globalLog.push(now);

  // 메모리 누수 방지: 키가 너무 많이 쌓이면 오래된 것부터 정리
  if (requestLog.size > 5000) {
    for (const [k, v] of requestLog) {
      if (prune(v, now).length === 0) requestLog.delete(k);
      if (requestLog.size <= 2500) break;
    }
  }
  return "ok";
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "anon";

  const limit = checkRateLimit(ip);
  if (limit !== "ok") {
    return NextResponse.json(
      {
        error:
          limit === "global"
            ? "AI 추천 사용량이 일시적으로 많습니다. 잠시 후 다시 시도해주세요."
            : `Too many requests. 시간당 ${RATE_LIMIT_MAX}회 한도 초과.`,
      },
      { status: 429, headers: { "Retry-After": "600" } },
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
    if (e instanceof SafetyBlockedError) {
      return NextResponse.json(
        { error: "입력 내용을 처리할 수 없습니다. 상황을 다르게 표현해 보세요." },
        { status: 400 },
      );
    }
    console.error("[ai/recommend] failed:", e);
    return NextResponse.json(
      { error: "AI 추천 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
