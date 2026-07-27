import { NextResponse } from "next/server";
import { fetchExternalPolicies } from "@/lib/scrapers/aggregate";

// 진단/디버그용 엔드포인트. 이전엔 force-dynamic + revalidate:0 이라
// 호출 1회당 상류 정부 API 수백 콜이 그대로 나갔다(공개 엔드포인트라 증폭 위험).
// CDN 캐시를 걸고, ?refresh=1 은 CRON_SECRET 보유자만 허용한다.
export const revalidate = 86400;

const CDN_CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("refresh") === "1") {
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization");
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const items = await fetchExternalPolicies();
  return NextResponse.json(
    {
      fetchedAt: new Date().toISOString(),
      count: items.length,
      items,
    },
    { headers: { "Cache-Control": CDN_CACHE } },
  );
}
