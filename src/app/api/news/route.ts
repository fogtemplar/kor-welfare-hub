import { NextResponse } from "next/server";
import { fetchKoreaKrPolicyNews } from "@/lib/scrapers/korea-kr";

export const revalidate = 3600; // 1시간 캐시

// 엣지에도 캐시해 서버리스 호출 자체를 줄인다.
const CDN_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET() {
  const items = await fetchKoreaKrPolicyNews();
  const news = items.map((p) => ({
    id: p.id,
    title: p.title,
    summary: p.summary,
    url: p.url,
    updatedAt: p.updatedAt,
    agency: p.agency,
    category: p.category,
  }));
  return NextResponse.json(
    {
      fetchedAt: new Date().toISOString(),
      count: news.length,
      items: news,
    },
    { headers: { "Cache-Control": CDN_CACHE } },
  );
}
