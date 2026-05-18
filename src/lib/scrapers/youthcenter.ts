import { promises as fs } from "node:fs";
import path from "node:path";
import type { Policy, PolicyCategory } from "@/lib/types";

// 온통청년 (청년정책 통합) API v2
// 신청: https://www.youthcenter.go.kr/opi/openApiList.do
// Endpoint (JSON): /go/ythip/getPlcy
const LIST_ENDPOINT = "https://www.youthcenter.go.kr/go/ythip/getPlcy";

const PAGE_SIZE = 100;
const MAX_PAGES = 30; // 약 3,000건 한도
const CONCURRENCY = 4;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "youthcenter.json");

type CacheShape = { fetchedAt: number; items: Policy[] };

type YouthPolicy = {
  plcyNo: string;
  plcyNm: string;
  plcyKywdNm?: string;
  plcyExplnCn?: string;
  lclsfNm?: string;
  mclsfNm?: string;
  plcySprtCn?: string;
  sprvsnInstCdNm?: string;
  operInstCdNm?: string;
  bizPrdEtcCn?: string;
  plcyAplyMthdCn?: string;
  aplyUrlAddr?: string;
  refUrlAddr1?: string;
  refUrlAddr2?: string;
  sprtTrgtMinAge?: string;
  sprtTrgtMaxAge?: string;
  sprtTrgtAgeLmtYn?: string;
  earnMinAmt?: string;
  earnMaxAmt?: string;
  addAplyQlfcCndCn?: string;
  rgtrUpInstCdNm?: string; // 시도
  rgtrInstCdNm?: string; // 시도/시군구
  rgtrHghrkInstCdNm?: string;
};

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
    console.warn("[youthcenter] cache write failed", e);
  }
}

async function fetchPage(
  key: string,
  page: number,
): Promise<{ items: Policy[]; totalCount: number } | null> {
  const url = new URL(LIST_ENDPOINT);
  url.searchParams.set("apiKeyNm", key);
  url.searchParams.set("pageSize", String(PAGE_SIZE));
  url.searchParams.set("pageNum", String(page));
  url.searchParams.set("rtnType", "json");

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: { "User-Agent": "kor-welfare-hub/0.1" },
    });
    if (!res.ok) {
      console.warn(`[youthcenter] HTTP ${res.status} on page ${page}`);
      return null;
    }
    const json = await res.json();
    if (json.resultCode !== 200 && json.resultCode !== "200") {
      console.warn(`[youthcenter] resultCode=${json.resultCode} (${json.resultMessage})`);
      return null;
    }
    const list = (json?.result?.youthPolicyList ?? []) as YouthPolicy[];
    const totalCount = Number(json?.result?.pagging?.totCount ?? 0);
    return { items: list.map(mapYouthPolicy), totalCount };
  } catch (e) {
    console.warn(`[youthcenter] fetch failed page ${page}`, e);
    return null;
  }
}

export async function fetchYouthcenterPolicies(opts: { forceRefresh?: boolean } = {}): Promise<Policy[]> {
  if (!opts.forceRefresh) {
    const cached = await readCache();
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.items;
    if (cached && !process.env.YOUTHCENTER_API_KEY) return cached.items;
  }

  const key = process.env.YOUTHCENTER_API_KEY;
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

  console.log(`[youthcenter] fetched ${deduped.length}/${first.totalCount} records across ${totalPages} pages`);
  await writeCache(deduped);
  return deduped;
}

function mapYouthPolicy(p: YouthPolicy): Policy {
  const today = new Date().toISOString().slice(0, 10);
  const region = normalizeRegion(
    p.rgtrUpInstCdNm || p.rgtrHghrkInstCdNm || p.rgtrInstCdNm || "",
  );
  const agency = p.sprvsnInstCdNm || p.operInstCdNm || p.rgtrInstCdNm || "청년정책";
  const summary = (p.plcyExplnCn || p.plcySprtCn || "").trim();
  const benefit = (p.plcySprtCn || "").trim();
  const eligibility =
    [p.addAplyQlfcCndCn, p.earnMinAmt && p.earnMaxAmt ? `소득 ${p.earnMinAmt}~${p.earnMaxAmt}` : "",
     p.sprtTrgtAgeLmtYn === "Y" ? `연령 ${p.sprtTrgtMinAge}~${p.sprtTrgtMaxAge}세` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  const howTo = (p.plcyAplyMthdCn || "").trim();
  const url = p.aplyUrlAddr || p.refUrlAddr1 || p.refUrlAddr2 ||
    `https://www.youthcenter.go.kr/youngPlcyUnif/youngPlcyUnifDtl.do?plcyNo=${p.plcyNo}`;

  const ageMin = p.sprtTrgtAgeLmtYn === "Y" && p.sprtTrgtMinAge ? Number(p.sprtTrgtMinAge) : undefined;
  const ageMax = p.sprtTrgtAgeLmtYn === "Y" && p.sprtTrgtMaxAge ? Number(p.sprtTrgtMaxAge) : undefined;

  const blob = `${p.plcyNm} ${summary} ${p.plcyKywdNm ?? ""} ${p.lclsfNm ?? ""} ${p.mclsfNm ?? ""}`;
  const category = inferCategory(blob, p.lclsfNm, p.mclsfNm);
  const audience = deriveAudience(blob);

  return {
    id: `youthcenter-${p.plcyNo}`,
    title: p.plcyNm,
    agency,
    level: region === "전국" ? "national" : agency.includes("구") || agency.includes("시청") ? "local" : "metro",
    region,
    category,
    audience,
    ageMin,
    ageMax,
    summary: summary.slice(0, 220) || "온통청년 통합검색 정책",
    benefit: benefit.slice(0, 180) || "온통청년 상세 페이지에서 확인",
    eligibility: eligibility || `만 ${ageMin ?? 19}~${ageMax ?? 39}세 청년`,
    howTo: howTo.slice(0, 200) || "온통청년 누리집에서 신청",
    url,
    source: "youthcenter",
    updatedAt: today,
    tags: [
      "청년정책",
      "온통청년",
      ...(p.plcyKywdNm ? [p.plcyKywdNm] : []),
      ...(p.lclsfNm ? [p.lclsfNm] : []),
    ].slice(0, 6),
  };
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

function inferCategory(text: string, lcls?: string, mcls?: string): PolicyCategory {
  // 온통청년 대분류 매핑
  if (lcls?.includes("일자리") || mcls?.includes("취업")) return "employment";
  if (lcls?.includes("주거")) return "housing";
  if (lcls?.includes("교육") || mcls?.includes("학자금") || mcls?.includes("장학")) return "education";
  if (lcls?.includes("복지") || lcls?.includes("문화")) return "culture";
  if (lcls?.includes("참여")) return "youth";
  // 텍스트 fallback
  if (/(주거|전세|월세|임대|주택|청약)/.test(text)) return "housing";
  if (/(취업|일자리|구직|이직|면접)/.test(text)) return "employment";
  if (/(창업|벤처|스타트업)/.test(text)) return "startup";
  if (/(장학|학자금|학교|학생|교육)/.test(text)) return "education";
  if (/(문화|여가|체육|관광|예술)/.test(text)) return "culture";
  if (/(건강|의료|심리)/.test(text)) return "health";
  if (/(농업|어업|귀농)/.test(text)) return "farm";
  return "youth";
}

function deriveAudience(text: string): string[] {
  const out = new Set<string>(["청년"]);
  if (/구직|미취업|실업/.test(text)) out.add("구직자");
  if (/재직|근로/.test(text)) out.add("재직자");
  if (/창업|벤처/.test(text)) out.add("예비창업자");
  if (/대학생|학생|대학원/.test(text)) out.add("대학생");
  if (/무주택|임차|월세|전세/.test(text)) out.add("무주택자");
  if (/신혼/.test(text)) out.add("신혼");
  if (/한부모/.test(text)) out.add("한부모");
  if (/여성|경력단절/.test(text)) out.add("여성");
  if (/저소득|기초생활|차상위/.test(text)) out.add("저소득");
  if (/장애/.test(text)) out.add("장애인");
  if (/농업|어업|영농|귀농/.test(text)) out.add("청년농업인");
  if (/다문화|결혼이민|탈북/.test(text)) out.add("다문화");
  return Array.from(out);
}
