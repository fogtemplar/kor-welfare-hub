import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const out: Record<string, any> = { at: new Date().toISOString() };

  // 1. bokjiro raw + cheerio parse
  try {
    const url = `https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001?serviceKey=${process.env.BOKJIRO_API_KEY}&callTp=L&pageNo=1&numOfRows=5&srchKeyCode=001`;
    const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": "kor-welfare-hub/0.1" } });
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const totalCount = $("totalCount").first().text().trim();
    const resultCode = $("resultCode").first().text().trim();
    const servListCount = $("servList").length;
    const firstServId = $("servList servId").first().text();
    out.bokjiro = {
      httpStatus: res.status,
      xmlLength: xml.length,
      totalCount,
      resultCode,
      servListCount,
      firstServId,
      xmlPeek: xml.slice(0, 200),
    };
  } catch (e: any) {
    out.bokjiro_error = String(e?.message ?? e);
  }

  // 2. youthcenter raw
  try {
    const url = `https://www.youthcenter.go.kr/go/ythip/getPlcy?apiKeyNm=${process.env.YOUTHCENTER_API_KEY}&pageSize=2&pageNum=1&rtnType=json`;
    const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": "kor-welfare-hub/0.1" } });
    const json = await res.json();
    out.youthcenter = {
      httpStatus: res.status,
      resultCode: json?.resultCode,
      totalCount: json?.result?.pagging?.totCount,
      itemCount: (json?.result?.youthPolicyList ?? []).length,
    };
  } catch (e: any) {
    out.youthcenter_error = String(e?.message ?? e);
  }

  // 3. cheerio version sanity
  try {
    const $ = cheerio.load("<a><b>hi</b></a>", { xmlMode: true });
    out.cheerio_ok = $("b").text() === "hi";
  } catch (e: any) {
    out.cheerio_error = String(e?.message ?? e);
  }

  return NextResponse.json(out);
}
