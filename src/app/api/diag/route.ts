import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const tests = [
    {
      name: "bokjiro",
      url: `http://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001?serviceKey=${process.env.BOKJIRO_API_KEY}&callTp=L&pageNo=1&numOfRows=2&srchKeyCode=001`,
    },
    {
      name: "bokjiro-https",
      url: `https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001?serviceKey=${process.env.BOKJIRO_API_KEY}&callTp=L&pageNo=1&numOfRows=2&srchKeyCode=001`,
    },
    {
      name: "youthcenter",
      url: `https://www.youthcenter.go.kr/go/ythip/getPlcy?apiKeyNm=${process.env.YOUTHCENTER_API_KEY}&pageSize=2&pageNum=1&rtnType=json`,
    },
    {
      name: "govService",
      url: `https://api.odcloud.kr/api/gov24/v3/serviceList?serviceKey=${process.env.GOV_SERVICE_API_KEY}&page=1&perPage=2&returnType=JSON`,
    },
    {
      name: "kstartup",
      url: `https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01?serviceKey=${process.env.KSTARTUP_API_KEY}&page=1&perPage=2&returnType=json`,
    },
  ];

  const results: any[] = [];

  for (const t of tests) {
    const start = Date.now();
    try {
      const res = await fetch(t.url, {
        cache: "no-store",
        headers: { "User-Agent": "kor-welfare-hub/0.1" },
      });
      const body = await res.text();
      results.push({
        name: t.name,
        status: res.status,
        ok: res.ok,
        took_ms: Date.now() - start,
        size: body.length,
        peek: body.slice(0, 300),
      });
    } catch (e: any) {
      results.push({
        name: t.name,
        took_ms: Date.now() - start,
        error: String(e?.message ?? e),
        cause: e?.cause ? String(e.cause) : undefined,
      });
    }
  }

  return NextResponse.json({ results, at: new Date().toISOString() }, { status: 200 });
}
