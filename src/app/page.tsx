import { CURATED_POLICIES } from "@/lib/data/policies";
import { Dashboard } from "@/components/Dashboard";
import { fetchExternalPolicies } from "@/lib/scrapers/aggregate";

// 빌드 시점이 아닌 요청 시점에 렌더 + 1시간 메모리 캐시
// Vercel serverless는 디스크 캐시 못 쓰므로 fetch revalidate 의존
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "default-no-store";

export default async function Page() {
  const external = await fetchExternalPolicies();
  const all = [...CURATED_POLICIES, ...external];
  return <Dashboard policies={all} />;
}
