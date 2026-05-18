import { NextResponse } from "next/server";
import { fetchKoreaKrPolicyNews } from "@/lib/scrapers/korea-kr";

export const revalidate = 3600; // 1시간 캐시

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
  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    count: news.length,
    items: news,
  });
}
