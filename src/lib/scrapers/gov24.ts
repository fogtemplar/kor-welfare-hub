import * as cheerio from "cheerio";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Policy, PolicyCategory } from "@/lib/types";

// 정부24 안내서비스 API (행정안전부)
// 신청: https://www.data.go.kr/data/15077048/openapi.do
// 상세 안내서비스 통합검색 (생애주기·관심사·대상별)
const LIST_ENDPOINT =
  "http://apis.data.go.kr/1741000/SponsorshipServiceInfoServ/getSponsorshipServiceInfoServ";

const PAGE_SIZE = 100;
const MAX_PAGES = 30;
const CONCURRENCY = 4;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "gov24.json");

type CacheShape = { fetchedAt: number; items: Policy[] };

async function readCache(): Promise<CacheShape | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as CacheShape;
    if (!parsed.fetchedAt || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(items: Policy[]): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(
      CACHE_FILE,
      JSON.stringify({ fetchedAt: Date.now(), items } satisfies CacheShape),
      "utf8",
    );
  } catch (e) {
    console.warn("[gov24] cache write failed", e);
  }
}

async function fetchPage(
  key: string,
  page: number,
): Promise<{ items: Policy[]; totalCount: number } | null> {
  const url = new URL(LIST_ENDPOINT);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("pageNo", String(page));
  url.searchParams.set("numOfRows", String(PAGE_SIZE));
  url.searchParams.set("type", "xml");

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: { "User-Agent": "kor-welfare-hub/0.1" },
    });
    if (!res.ok) return null;
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const resultCode = $("resultCode").first().text().trim();
    if (resultCode && resultCode !== "0" && resultCode !== "00") {
      console.warn(`[gov24] resultCode=${resultCode} — check GOV24_API_KEY`);
      return null;
    }
    const totalCount = Number($("totalCount").first().text().trim() || "0");
    return { items: parseXml(xml), totalCount };
  } catch (e) {
    console.warn("[gov24] page fetch failed", page, e);
    return null;
  }
}

export async function fetchGov24Policies(opts: { forceRefresh?: boolean } = {}): Promise<Policy[]> {
  if (!opts.forceRefresh) {
    const cached = await readCache();
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.items;
    if (cached && !process.env.GOV24_API_KEY) return cached.items;
  }

  const key = process.env.GOV24_API_KEY;
  if (!key) return [];

  const first = await fetchPage(key, 1);
  if (!first) {
    const stale = await readCache();
    return stale?.items ?? [];
  }

  const totalPages = Math.min(
    MAX_PAGES,
    Math.max(1, Math.ceil(first.totalCount / PAGE_SIZE)),
  );

  const all: Policy[] = [...first.items];
  if (totalPages > 1) {
    const remaining: number[] = [];
    for (let p = 2; p <= totalPages; p++) remaining.push(p);
    for (let i = 0; i < remaining.length; i += CONCURRENCY) {
      const batch = remaining.slice(i, i + CONCURRENCY);
      const got = await Promise.all(batch.map((p) => fetchPage(key, p)));
      for (const r of got) if (r) all.push(...r.items);
    }
  }

  const seen = new Set<string>();
  const deduped: Policy[] = [];
  for (const p of all) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    deduped.push(p);
  }

  console.log(`[gov24] fetched ${deduped.length}/${first.totalCount} records across ${totalPages} pages`);
  await writeCache(deduped);
  return deduped;
}

function parseXml(xml: string): Policy[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const out: Policy[] = [];
  const today = new Date().toISOString().slice(0, 10);

  // 정부24 안내서비스의 item 구조는 endpoint마다 약간 다름.
  // 가장 흔한 필드명을 우선 매칭 (servId/serviceId, servNm/serviceName 등)
  $("item, servList").each((_, el) => {
    const $el = $(el);
    const id = pick($el, "servId") || pick($el, "serviceId");
    const title = pick($el, "servNm") || pick($el, "serviceName");
    if (!id || !title) return;

    const summary =
      pick($el, "servDgst") || pick($el, "serviceSummary") || pick($el, "supportContents");
    const agency =
      pick($el, "jurOrgNm") || pick($el, "deptName") || pick($el, "organName") || "정부24";
    const region = pick($el, "areaNm") || pick($el, "regionName") || "전국";
    const link = pick($el, "servDtlLink") || pick($el, "linkUrl");

    const blob = `${title} ${summary}`;
    out.push({
      id: `gov24-${id}`,
      title,
      agency,
      level: region === "전국" ? "national" : "metro",
      region,
      category: inferCategory(blob),
      audience: deriveAudience(blob),
      summary: summary.slice(0, 220) || "정부24에서 안내하는 행정서비스입니다.",
      benefit: "정부24 상세 페이지에서 확인",
      eligibility: pick($el, "trgtNm") || pick($el, "targetName") || "정부24 상세 페이지 참조",
      howTo: pick($el, "applMthdNm") || "정부24 누리집에서 신청 또는 행정복지센터",
      url: link || `https://www.gov.kr/portal/svcExpl/svcExplDetail/${id}`,
      source: "gov24",
      updatedAt: today,
      tags: ["정부24"],
    });
  });

  return out;
}

function pick($el: cheerio.Cheerio<any>, tag: string): string {
  return $el.find(tag).first().text().trim();
}

function inferCategory(text: string): PolicyCategory {
  if (/(청년|취업청년)/.test(text)) return "youth";
  if (/(주거|전세|월세|임대|주택|청약)/.test(text)) return "housing";
  if (/(출산|임신|육아|아동|보육|영유아|돌봄)/.test(text)) return "childcare";
  if (/(취업|일자리|고용|구직|실업)/.test(text)) return "employment";
  if (/(창업|벤처|소상공인)/.test(text)) return "startup";
  if (/(장학|학자금|학교|학생)/.test(text)) return "education";
  if (/(노인|어르신|기초연금)/.test(text)) return "senior";
  if (/장애/.test(text)) return "disability";
  if (/(기초생활|차상위|긴급|저소득|생계)/.test(text)) return "lowincome";
  if (/(의료|건강|병원|진료)/.test(text)) return "health";
  if (/(농업|어업|귀농)/.test(text)) return "farm";
  if (/(문화|여가|체육|관광)/.test(text)) return "culture";
  return "lowincome";
}

function deriveAudience(text: string): string[] {
  const out = new Set<string>(["전국민"]);
  const rules: [RegExp, string][] = [
    [/청년/, "청년"], [/노인|어르신/, "노인"], [/아동/, "아동가구"],
    [/영유아|영아/, "영아가구"], [/임산부|임신/, "임산부"], [/출산/, "출산가구"],
    [/장애/, "장애인"], [/한부모/, "한부모"], [/다자녀/, "다자녀"],
    [/다문화|결혼이민/, "다문화"], [/저소득|기초생활|차상위/, "저소득"],
    [/구직|미취업/, "구직자"], [/근로|재직/, "재직자"], [/창업/, "예비창업자"],
    [/대학생|학생/, "대학생"], [/무주택|임차/, "무주택자"],
    [/여성|경력단절/, "여성"],
  ];
  for (const [re, tag] of rules) if (re.test(text)) out.add(tag);
  return Array.from(out);
}
