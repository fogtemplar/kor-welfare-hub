import { NextResponse } from "next/server";
import { CURATED_POLICIES } from "@/lib/data/policies";
import { fetchExternalPolicies } from "@/lib/scrapers/aggregate";
import { applyFilter, DEFAULT_FILTER } from "@/lib/filter";
import type { PolicyCategory } from "@/lib/types";

// Vercel 콜드스타트마다 정부 API 5곳을 재집계하면 ~20초가 걸린다.
// 엣지(CDN)에 응답을 캐시해, 최초 1회 생성 후엔 즉시 서빙한다.
// stale-while-revalidate: 만료 후에도 캐시본을 즉시 주고 백그라운드 갱신.
const CDN_CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const external = await fetchExternalPolicies();
  const all = [...CURATED_POLICIES, ...external];

  const filter = {
    ...DEFAULT_FILTER,
    q: searchParams.get("q") ?? "",
    category: (searchParams.get("category") as PolicyCategory | "all") ?? "all",
    region: searchParams.get("region") ?? "전국",
    level: (searchParams.get("level") as "all" | "national" | "metro" | "local") ?? "all",
    age: searchParams.get("age") ? Number(searchParams.get("age")) : undefined,
    sort: (searchParams.get("sort") as "recent" | "alpha") ?? "recent",
  };

  const results = applyFilter(all, filter);
  return NextResponse.json(
    {
      count: results.length,
      total: all.length,
      sources: {
        curated: CURATED_POLICIES.length,
        external: external.length,
      },
      items: results,
    },
    { headers: { "Cache-Control": CDN_CACHE } },
  );
}
