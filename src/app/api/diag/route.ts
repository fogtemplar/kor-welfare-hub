import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// bokjiro fetchPage 흉내 + 단계별 로그
async function debugBokjiroPage(pageSize: number) {
  const out: any = { pageSize };
  const url = new URL(
    "https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001",
  );
  url.searchParams.set("serviceKey", process.env.BOKJIRO_API_KEY ?? "");
  url.searchParams.set("callTp", "L");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", String(pageSize));
  url.searchParams.set("srchKeyCode", "001");

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: { "User-Agent": "kor-welfare-hub/0.1" },
    });
    out.httpStatus = res.status;
    const xml = await res.text();
    out.xmlLength = xml.length;
    out.xmlHead = xml.slice(0, 150);
    out.xmlTail = xml.slice(-150);

    try {
      const $ = cheerio.load(xml, { xmlMode: true });
      out.cheerio = "OK";
      out.resultCode = $("resultCode").first().text().trim();
      out.totalCount = $("totalCount").first().text().trim();
      out.servListCount = $("servList").length;
      // each 안의 동작 확인
      let firstServId = "";
      let firstServNm = "";
      let parsedCount = 0;
      $("servList").each((_, el) => {
        const $el = $(el);
        const id = $el.find("servId").first().text().trim();
        const nm = $el.find("servNm").first().text().trim();
        if (id && nm) {
          parsedCount++;
          if (!firstServId) {
            firstServId = id;
            firstServNm = nm;
          }
        }
      });
      out.parsedCount = parsedCount;
      out.firstServId = firstServId;
      out.firstServNm = firstServNm;
    } catch (parseErr: any) {
      out.cheerio_error = String(parseErr?.message ?? parseErr);
    }
  } catch (fetchErr: any) {
    out.fetch_error = String(fetchErr?.message ?? fetchErr);
  }

  return out;
}

export async function GET() {
  return NextResponse.json({
    at: new Date().toISOString(),
    smallPage: await debugBokjiroPage(5),
    bigPage: await debugBokjiroPage(500),
  });
}
