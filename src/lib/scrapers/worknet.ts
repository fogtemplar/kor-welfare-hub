import * as cheerio from "cheerio";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Policy, PolicyCategory } from "@/lib/types";

// 워크넷 (고용24) OpenAPI — 복지 관련 두 서비스만 사용
// 신청: https://www.work24.go.kr/cm/openApi/main.do
//
// 복지 매칭에 의미 있는 서비스:
//   1) 국민내일배움카드 훈련과정 (HRD)        → WORKNET_HRD_KEY
//   2) 구직자취업역량 강화프로그램            → WORKNET_JOBSEEKER_KEY
// 채용정보(job listings)는 휘발성 큼 → 별도 페이지 권장, 여기선 제외.
const HRD_ENDPOINT =
  "https://www.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo210L01.do";
const JOBSEEKER_ENDPOINT =
  "https://www.work24.go.kr/cm/openApi/call/eg/callOpenApiSvcInfo50L01.do";

const PAGE_SIZE = 50;
const MAX_PAGES = 40;
const CONCURRENCY = 4;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "worknet.json");

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
    console.warn("[worknet] cache write failed", e);
  }
}

type ServiceTag = "hrd" | "jobseeker";

async function fetchPage(
  endpoint: string,
  key: string,
  page: number,
  tag: ServiceTag,
): Promise<{ items: Policy[]; totalCount: number } | null> {
  const url = new URL(endpoint);
  url.searchParams.set("authKey", key);
  url.searchParams.set("returnType", "XML");
  url.searchParams.set("pageNum", String(page));
  url.searchParams.set("pageSize", String(PAGE_SIZE));

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 86400 },
      headers: { "User-Agent": "kor-welfare-hub/0.1" },
    });
    if (!res.ok) return null;
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const errCode = $("errCode").first().text().trim() || $("resultCode").first().text().trim();
    if (errCode && errCode !== "0" && errCode !== "00") {
      console.warn(`[worknet:${tag}] errCode=${errCode} — check API key (Decoding)`);
      return null;
    }
    const totalCount = Number($("total").first().text().trim() || $("totalCount").first().text().trim() || "0");
    return { items: parseXml(xml, tag), totalCount };
  } catch (e) {
    console.warn(`[worknet:${tag}] page fetch failed`, page, e);
    return null;
  }
}

async function fetchService(endpoint: string, key: string, tag: ServiceTag): Promise<Policy[]> {
  const first = await fetchPage(endpoint, key, 1, tag);
  if (!first) return [];
  const totalPages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(first.totalCount / PAGE_SIZE)));
  const all: Policy[] = [...first.items];
  if (totalPages > 1) {
    const remaining: number[] = [];
    for (let p = 2; p <= totalPages; p++) remaining.push(p);
    for (let i = 0; i < remaining.length; i += CONCURRENCY) {
      const batch = remaining.slice(i, i + CONCURRENCY);
      const got = await Promise.all(batch.map((p) => fetchPage(endpoint, key, p, tag)));
      for (const r of got) if (r) all.push(...r.items);
    }
  }
  console.log(`[worknet:${tag}] fetched ${all.length}/${first.totalCount}`);
  return all;
}

export async function fetchWorknetPolicies(opts: { forceRefresh?: boolean } = {}): Promise<Policy[]> {
  if (!opts.forceRefresh) {
    const cached = await readCache();
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.items;
    if (
      cached &&
      !process.env.WORKNET_HRD_KEY &&
      !process.env.WORKNET_JOBSEEKER_KEY &&
      !process.env.WORKNET_API_KEY
    ) return cached.items;
  }

  // 서비스별 키 (없으면 해당 서비스 건너뜀)
  const hrdKey = process.env.WORKNET_HRD_KEY || process.env.WORKNET_API_KEY;
  const jobseekerKey = process.env.WORKNET_JOBSEEKER_KEY || process.env.WORKNET_API_KEY;

  if (!hrdKey && !jobseekerKey) return [];

  const tasks: Promise<Policy[]>[] = [];
  if (hrdKey) tasks.push(fetchService(HRD_ENDPOINT, hrdKey, "hrd"));
  if (jobseekerKey && jobseekerKey !== hrdKey)
    tasks.push(fetchService(JOBSEEKER_ENDPOINT, jobseekerKey, "jobseeker"));

  const results = await Promise.all(tasks);
  const all = results.flat();

  if (all.length === 0) {
    const stale = await readCache();
    return stale?.items ?? [];
  }

  const seen = new Set<string>();
  const deduped: Policy[] = [];
  for (const p of all) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    deduped.push(p);
  }

  console.log(`[worknet] total fetched: ${deduped.length}`);
  await writeCache(deduped);
  return deduped;
}

function parseXml(xml: string, tag: ServiceTag = "hrd"): Policy[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const out: Policy[] = [];
  const today = new Date().toISOString().slice(0, 10);

  // HRD 훈련과정·구직자취업역량 응답 공통 셀렉터
  $("item, trainCourse, scrapingResult").each((_, el) => {
    const $el = $(el);
    const id =
      pick($el, "trprId") ||
      pick($el, "trprDegr") ||
      pick($el, "wantedAuthNo") ||
      pick($el, "infoId") ||
      pick($el, "id");
    const title =
      pick($el, "trprNm") ||
      pick($el, "subTitle") ||
      pick($el, "title") ||
      pick($el, "wantedTitle");
    if (!id || !title) return;

    const inst = pick($el, "trainInstNm") || pick($el, "company") || "고용노동부";
    const summary =
      pick($el, "trainTarget") || pick($el, "outline") || pick($el, "jobsCd") || "";
    const region = normalizeRegion(pick($el, "address") || pick($el, "region") || "");
    const link = pick($el, "trainStartDate") ? "" : pick($el, "wantedInfoUrl") || "";
    const cost = pick($el, "courseMan") || pick($el, "realMan") || "";
    const period =
      pick($el, "trainStartDate") && pick($el, "trainEndDate")
        ? `${pick($el, "trainStartDate")} ~ ${pick($el, "trainEndDate")}`
        : "";

    const blob = `${title} ${summary}`;
    const isHrd = tag === "hrd";
    out.push({
      id: `worknet-${tag}-${id}`,
      title,
      agency: isHrd ? `고용노동부 · ${inst}` : "고용노동부",
      level: region === "전국" ? "national" : "metro",
      region,
      category: "employment",
      audience: deriveAudience(blob),
      summary: summary.slice(0, 200) ||
        (isHrd ? "국민내일배움카드로 수강 가능한 직업훈련 과정" : "구직자 취업역량 강화 프로그램"),
      benefit: isHrd
        ? `훈련비 ${cost ? `약 ${cost}원 ` : ""}(국민내일배움카드 한도 내 지원)${period ? ` · 기간 ${period}` : ""}`
        : "구직활동 보조금 + 프로그램 무료 참여",
      eligibility: isHrd
        ? "국민내일배움카드 발급자 (5년 한도 500만원)"
        : "워크넷 구직등록자",
      howTo: isHrd
        ? "HRD-Net(hrd.go.kr) 또는 고용센터 방문 신청"
        : "워크넷·고용센터 상담 후 참여",
      url:
        link.startsWith("http")
          ? link
          : isHrd
            ? `https://www.hrd.go.kr/hrdp/co/pcCoTrngCcd1100.do?trprId=${id}`
            : `https://www.work24.go.kr/wk/`,
      source: "worknet",
      updatedAt: today,
      tags: ["워크넷", isHrd ? "내일배움카드" : "구직지원"],
    });
  });

  return out;
}

function pick($el: cheerio.Cheerio<any>, tag: string): string {
  return $el.find(tag).first().text().trim();
}

function normalizeRegion(s: string): string {
  if (!s) return "전국";
  const map: Record<string, string> = {
    서울: "서울특별시", 부산: "부산광역시", 대구: "대구광역시", 인천: "인천광역시",
    광주: "광주광역시", 대전: "대전광역시", 울산: "울산광역시", 세종: "세종특별자치시",
    경기: "경기도", 강원: "강원특별자치도", 충북: "충청북도", 충남: "충청남도",
    전북: "전북특별자치도", 전남: "전라남도", 경북: "경상북도", 경남: "경상남도",
    제주: "제주특별자치도",
  };
  for (const k of Object.keys(map)) if (s.startsWith(k)) return map[k];
  return "전국";
}

function deriveAudience(text: string): string[] {
  const out = new Set<string>(["구직자"]);
  if (/청년/.test(text)) out.add("청년");
  if (/중장년|장년/.test(text)) out.add("중장년");
  if (/여성|경력단절/.test(text)) {
    out.add("여성");
    out.add("경력단절");
  }
  if (/장애/.test(text)) out.add("장애인");
  if (/실업/.test(text)) out.add("퇴직자");
  if (/훈련|재교육/.test(text)) out.add("재직자");
  return Array.from(out);
}
