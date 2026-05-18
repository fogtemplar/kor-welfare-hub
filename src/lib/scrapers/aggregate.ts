import type { Policy } from "@/lib/types";
import { fetchBokjiroPolicies } from "./bokjiro";
import { fetchYouthcenterPolicies } from "./youthcenter";
import { fetchGov24Policies } from "./gov24";
import { fetchWorknetPolicies } from "./worknet";
import { fetchKStartupPolicies } from "./kstartup";
import { fetchGovServicePolicies } from "./govService";

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
  // 출처 다른 항목 간 제목+기관 중복 제거 (큰 차원에서)
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
