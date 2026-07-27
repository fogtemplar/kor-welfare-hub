import { CURATED_POLICIES } from "@/lib/data/policies";
import { Dashboard } from "@/components/Dashboard";
import { fetchExternalPolicies } from "@/lib/scrapers/aggregate";

// 정부 API 집계 결과는 하루 단위로만 바뀐다.
// force-dynamic + fetchCache:"default-no-store"를 쓰면 하위 fetch의
// Data Cache가 전부 무효화되어 방문자 1명당 상류 API 수백 콜이 발생한다.
// ISR(24h)로 전환해 페이지 자체를 캐시한다.
export const revalidate = 86400;

// 전체(수만 건)를 RSC 페이로드에 직렬화하면 모바일 WebView에서
// JSON 파싱만 수 초가 걸린다. 첫 화면에 필요한 만큼만 심어 보내고,
// 나머지는 CDN 캐시된 /api/policies 에서 마운트 후 받아온다.
const INITIAL_COUNT = 300;

export default async function Page() {
  const external = await fetchExternalPolicies();
  const all = [...CURATED_POLICIES, ...external];
  return (
    <Dashboard
      policies={all.slice(0, INITIAL_COUNT)}
      totalCount={all.length}
    />
  );
}
