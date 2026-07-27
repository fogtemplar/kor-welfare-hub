import type { Policy } from "@/lib/types";
import { fetchBokjiroPolicies } from "./bokjiro";
import { fetchYouthcenterPolicies } from "./youthcenter";
import { fetchGov24Policies } from "./gov24";
import { fetchWorknetPolicies } from "./worknet";
import { fetchKStartupPolicies } from "./kstartup";
import { fetchGovServicePolicies } from "./govService";
import { refineRegion } from "@/lib/regionMap";
import { enrichAge } from "@/lib/lifeStage";

// 워크넷(고용24) endpoint 정확한 URL 확인 전까지 비활성화
const WORKNET_ENABLED = process.env.WORKNET_ENABLE === "true";

// 정책브리핑(korea.kr) RSS는 뉴스 기사라 복지 혜택 매칭에 부적합 → 제거
// 필요 시 다시 추가: import { fetchKoreaKrPolicyNews } from "./korea-kr";

// 프로세스 메모리 캐시 + in-flight 중복 제거.
// 같은 인스턴스에서 동시 요청 10건이 들어와도 상류 호출은 1회만 나간다.
const MEM_TTL_MS = 6 * 60 * 60 * 1000; // 6h
let memCache: { at: number; items: Policy[] } | null = null;
let inFlight: Promise<Policy[]> | null = null;

export async function fetchExternalPolicies(): Promise<Policy[]> {
  if (memCache && Date.now() - memCache.at < MEM_TTL_MS) return memCache.items;
  if (inFlight) return inFlight;
  inFlight = aggregate()
    .then(({ items, complete }) => {
      // 일부 공공 API가 일시적으로 실패하면 불완전한 결과로 정상 캐시를
      // 덮어쓰지 않는다. 같은 인스턴스에 기존 데이터가 있으면 stale 값을
      // 계속 제공하고 다음 요청에서 갱신을 다시 시도한다.
      if (!complete && memCache) {
        console.warn(
          `[aggregate] partial refresh (${items.length}) — keeping stale cache (${memCache.items.length})`,
        );
        return memCache.items;
      }
      if (items.length > 0) memCache = { at: Date.now(), items };
      return items;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

async function aggregate(): Promise<{ items: Policy[]; complete: boolean }> {
  const tasks: Promise<Policy[]>[] = [
    fetchBokjiroPolicies(),
    fetchYouthcenterPolicies(),
    fetchGov24Policies(),
    fetchKStartupPolicies(),
    fetchGovServicePolicies(),
  ];
  if (WORKNET_ENABLED) tasks.push(fetchWorknetPolicies());
  const results = await Promise.allSettled(tasks);
  const complete = results.every(
    (result) => result.status === "fulfilled" && result.value.length > 0,
  );
  const policies: Policy[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") policies.push(...r.value);
  }
  // 후처리 0: 소스 구분 없이, 본문에 명시된 연령 조건("만 19세~34세" 등)을
  // 구조화 필드로 끌어올린다. 명시적 표현만 처리하므로 오차단 위험이 낮다.
  for (const p of policies) {
    enrichAge(p, { texts: [p.title, p.eligibility, p.summary] });
  }

  // 후처리 1: region이 "전국"이지만 제목·기관·요약에 시·군·구 키워드 있으면 시도로 보정
  for (const p of policies) {
    const refined = refineRegion(p.region ?? "전국", p.title, p.agency, p.summary);
    if (refined !== p.region) {
      p.region = refined;
      p.level = "metro";
    }
  }

  // 후처리 2: 출처 다른 항목 간 제목+기관 중복 제거
  const seen = new Set<string>();
  const deduped: Policy[] = [];
  for (const p of policies) {
    const key = `${p.title}|${p.agency.split(" · ")[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(p);
  }
  return { items: deduped, complete };
}
