import type { Policy } from "@/lib/types";
import { fetchBokjiroPolicies } from "./bokjiro";
import { fetchYouthcenterPolicies } from "./youthcenter";
import { fetchGov24Policies } from "./gov24";
import { fetchWorknetPolicies } from "./worknet";
import { fetchKStartupPolicies } from "./kstartup";
import { fetchGovServicePolicies } from "./govService";
import { refineRegion } from "@/lib/regionMap";

// 워크넷(고용24) endpoint 정확한 URL 확인 전까지 비활성화
const WORKNET_ENABLED = process.env.WORKNET_ENABLE === "true";

// 정책브리핑(korea.kr) RSS는 뉴스 기사라 복지 혜택 매칭에 부적합 → 제거
// 필요 시 다시 추가: import { fetchKoreaKrPolicyNews } from "./korea-kr";

export async function fetchExternalPolicies(): Promise<Policy[]> {
  const tasks: Promise<Policy[]>[] = [
    fetchBokjiroPolicies(),
    fetchYouthcenterPolicies(),
    fetchGov24Policies(),
    fetchKStartupPolicies(),
    fetchGovServicePolicies(),
  ];
  if (WORKNET_ENABLED) tasks.push(fetchWorknetPolicies());
  const results = await Promise.allSettled(tasks);
  const policies: Policy[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") policies.push(...r.value);
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
  return deduped;
}
