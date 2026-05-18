import * as cheerio from "cheerio";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Policy, PolicyCategory } from "@/lib/types";

// 한국사회보장정보원 — 같은 키로 두 엔드포인트 모두 호출 가능
const CENTRAL_ENDPOINT =
  "http://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001";
const LOCAL_ENDPOINT =
  "http://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist";

const ENDPOINTS: { url: string; tag: "central" | "local" }[] = [
  { url: CENTRAL_ENDPOINT, tag: "central" },
  { url: LOCAL_ENDPOINT, tag: "local" },
];

const LIST_ENDPOINT = CENTRAL_ENDPOINT; // 하위호환

const PAGE_SIZE = 500;        // API max per request (cuts request count drastically)
const MAX_PAGES = 80;         // safety cap (~40,000 records)
const CONCURRENCY = 4;        // parallel page fetches (API tolerates ~5/s)
const REVALIDATE_SECONDS = 86400; // 24h CDN revalidate
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h disk cache

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "bokjiro.json");

type CacheShape = { fetchedAt: number; items: Policy[] };

async function fetchPage(
  endpoint: string,
  key: string,
  page: number,
  tag: "central" | "local",
): Promise<{ items: Policy[]; totalCount: number } | null> {
  const url = new URL(endpoint);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("callTp", "L");
  url.searchParams.set("pageNo", String(page));
  url.searchParams.set("numOfRows", String(PAGE_SIZE));
  url.searchParams.set("srchKeyCode", "001");

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { "User-Agent": "kor-welfare-hub/0.1" },
    });
    if (!res.ok) return null;
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const resultCode = $("resultCode").first().text().trim();
    if (resultCode && resultCode !== "0" && resultCode !== "00") {
      console.warn(`[bokjiro:${tag}] resultCode=${resultCode} (check BOKJIRO_API_KEY — Decoding key)`);
      return null;
    }
    const totalCount = Number($("totalCount").first().text().trim() || "0");
    const items = parseBokjiroXml(xml, tag);
    return { items, totalCount };
  } catch (e) {
    console.warn(`[bokjiro:${tag}] page fetch failed`, page, e);
    return null;
  }
}

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
    const payload: CacheShape = { fetchedAt: Date.now(), items };
    await fs.writeFile(CACHE_FILE, JSON.stringify(payload), "utf8");
  } catch (e) {
    console.warn("[bokjiro] failed to write cache", e);
  }
}

async function fetchAllPagesForEndpoint(
  key: string,
  endpoint: string,
  tag: "central" | "local",
): Promise<Policy[]> {
  const first = await fetchPage(endpoint, key, 1, tag);
  if (!first) return [];

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
      const results = await Promise.all(
        batch.map((p) => fetchPage(endpoint, key, p, tag)),
      );
      for (const r of results) if (r) all.push(...r.items);
    }
  }
  console.log(`[bokjiro:${tag}] fetched ${all.length}/${first.totalCount} records across ${totalPages} pages`);
  return all;
}

export async function fetchBokjiroPolicies(opts: { forceRefresh?: boolean } = {}): Promise<Policy[]> {
  // Disk cache first — avoids hitting the daily API quota on every SSR render
  if (!opts.forceRefresh) {
    const cached = await readCache();
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.items;
    }
    // Stale cache fallback: if no key, still return stale data instead of nothing
    if (cached && !process.env.BOKJIRO_API_KEY?.trim()) return cached.items;
  }

  const key = process.env.BOKJIRO_API_KEY?.trim();
  if (!key) return [];

  // 두 엔드포인트(중앙·지자체)를 병렬로 호출
  const [central, local] = await Promise.all([
    fetchAllPagesForEndpoint(key, CENTRAL_ENDPOINT, "central"),
    fetchAllPagesForEndpoint(key, LOCAL_ENDPOINT, "local"),
  ]);
  const all = [...central, ...local];

  if (all.length === 0) {
    // 둘 다 실패: stale 캐시 fallback
    const stale = await readCache();
    return stale?.items ?? [];
  }

  // Dedup by id (API can return duplicates across pages near boundaries)
  const seen = new Set<string>();
  const deduped: Policy[] = [];
  for (const p of all) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    deduped.push(p);
  }

  console.log(`[bokjiro] total fetched: ${deduped.length} (central=${central.length}, local=${local.length})`);
  await writeCache(deduped);
  return deduped;
}

function parseBokjiroXml(xml: string, tag: "central" | "local" = "central"): Policy[] {
  const $ = cheerio.load(xml, { xmlMode: true });

  const resultCode = $("resultCode").first().text().trim();
  if (resultCode && resultCode !== "0" && resultCode !== "00") {
    return [];
  }

  const out: Policy[] = [];
  $("servList").each((_, el) => {
    const $el = $(el);
    const servId = text($el, "servId");
    const servNm = text($el, "servNm");
    if (!servId || !servNm) return;

    const jurMnofNm = text($el, "jurMnofNm");
    const bizChrDeptNm = text($el, "bizChrDeptNm");
    const servDgst = text($el, "servDgst");
    const ctpvNm = text($el, "ctpvNm");
    const sggNm = text($el, "sggNm");
    const link = text($el, "servDtlLink");
    const lifeArray = text($el, "lifeArray");
    const intrsThemaArray = text($el, "intrsThemaArray");
    const trgterIndvdlArray = text($el, "trgterIndvdlArray");

    const agency =
      [jurMnofNm, bizChrDeptNm].filter(Boolean).join(" · ") ||
      (tag === "local" ? `${ctpvNm || "지자체"}${sggNm ? ` ${sggNm}` : ""}` : "보건복지부");
    const level: Policy["level"] = sggNm ? "local" : ctpvNm ? "metro" : "national";
    const blob = `${servNm} ${servDgst} ${intrsThemaArray} ${trgterIndvdlArray} ${lifeArray}`;

    out.push({
      id: `bokjiro-${tag}-${servId}`,
      title: servNm,
      agency,
      level,
      region: normalizeRegion(ctpvNm),
      district: sggNm || undefined,
      category: inferCategory(blob),
      audience: deriveAudience(blob),
      summary: servDgst.slice(0, 220) || `${jurMnofNm || "정부"}에서 운영하는 복지서비스입니다.`,
      benefit: "복지로 상세 페이지에서 확인 (지원 내용 다양)",
      eligibility: "복지로 상세 페이지에서 확인",
      howTo: "복지로 누리집 또는 주소지 행정복지센터",
      url:
        link ||
        `https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52011M.do?wlfareInfoId=${servId}`,
      source: "bokjiro",
      updatedAt: new Date().toISOString().slice(0, 10),
      tags: ["복지로", tag === "local" ? "지자체" : "중앙부처", ...tokensFromMeta(intrsThemaArray, lifeArray)],
    });
  });

  return out;
}

function text($el: cheerio.Cheerio<any>, tag: string): string {
  return $el.find(tag).first().text().trim();
}

function normalizeRegion(s: string): string {
  if (!s) return "전국";
  const map: Record<string, string> = {
    서울: "서울특별시",
    부산: "부산광역시",
    대구: "대구광역시",
    인천: "인천광역시",
    광주: "광주광역시",
    대전: "대전광역시",
    울산: "울산광역시",
    세종: "세종특별자치시",
    경기: "경기도",
    강원: "강원특별자치도",
    충북: "충청북도",
    충남: "충청남도",
    전북: "전북특별자치도",
    전남: "전라남도",
    경북: "경상북도",
    경남: "경상남도",
    제주: "제주특별자치도",
  };
  for (const key of Object.keys(map)) if (s.startsWith(key)) return map[key];
  return s;
}

function inferCategory(text: string): PolicyCategory {
  if (/(청년|취업청년|미취업청년)/.test(text)) return "youth";
  if (/(주거|전세|월세|임대|주택|청약|보금자리)/.test(text)) return "housing";
  if (/(출산|임신|육아|아동|보육|어린이집|영유아|돌봄)/.test(text)) return "childcare";
  if (/(취업|일자리|고용|구직|실업|직업훈련)/.test(text)) return "employment";
  if (/(창업|벤처|스타트업|소상공인)/.test(text)) return "startup";
  if (/(장학|학자금|학교|학습|학생)/.test(text)) return "education";
  if (/(노인|어르신|기초연금|경로)/.test(text)) return "senior";
  if (/(장애|장애인)/.test(text)) return "disability";
  if (/(기초생활|차상위|긴급|저소득|생계|의료급여|주거급여)/.test(text)) return "lowincome";
  if (/(의료|건강|병원|진료|치료|예방접종)/.test(text)) return "health";
  if (/(농어업|농업|어업|수산|귀농|영농)/.test(text)) return "farm";
  if (/(문화|여가|체육|관광|예술)/.test(text)) return "culture";
  return "lowincome";
}

function deriveAudience(text: string): string[] {
  const out = new Set<string>();
  const map: [RegExp, string][] = [
    [/청년/, "청년"],
    [/노인|어르신/, "노인"],
    [/아동/, "아동가구"],
    [/영유아|영아/, "영아가구"],
    [/임산부|임신/, "임산부"],
    [/출산/, "출산가구"],
    [/장애/, "장애인"],
    [/한부모|조손/, "한부모"],
    [/다자녀/, "다자녀"],
    [/다문화|결혼이민|탈북/, "다문화"],
    [/저소득|기초생활|차상위/, "저소득"],
    [/구직|미취업/, "구직자"],
    [/근로|재직/, "재직자"],
    [/창업|벤처/, "예비창업자"],
    [/대학생|학생/, "대학생"],
    [/무주택|임차/, "무주택자"],
    [/농업|어업|농어민/, "청년농업인"],
    [/여성|경력단절/, "여성"],
  ];
  for (const [re, tag] of map) if (re.test(text)) out.add(tag);
  if (out.size === 0) out.add("전국민");
  return Array.from(out);
}

function tokensFromMeta(intrs: string, life: string): string[] {
  const out = new Set<string>();
  for (const piece of [intrs, life]) {
    if (!piece) continue;
    for (const part of piece.split(/[,，·;]/).map((s) => s.trim()).filter(Boolean)) {
      out.add(part);
    }
  }
  return Array.from(out).slice(0, 5);
}
