import { promises as fs } from "node:fs";
import path from "node:path";
import type { Policy } from "@/lib/types";

// 창업진흥원_K-Startup 사업공고 OpenAPI
// 신청: https://www.data.go.kr/data/15121654/openapi.do (또는 검색 "창업진흥원 K-Startup")
// Endpoint: getAnnouncementInformation01 (사업공고)
const LIST_ENDPOINT =
  "https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01";

const PAGE_SIZE = 100;
const MAX_PAGES = 30;
const CONCURRENCY = 4;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "kstartup.json");

type CacheShape = { fetchedAt: number; items: Policy[] };

type KStartupItem = {
  pbanc_sn?: string | number; // 공고 일련번호
  biz_pbanc_nm?: string; // 공고명
  intg_pbanc_biz_nm?: string; // 사업명
  pbanc_ctnt?: string; // 공고 내용
  biz_enyy?: string; // 사업 연도
  supt_biz_clsfc?: string; // 사업분류
  supt_regin?: string; // 지원지역
  biz_trgt_age?: string; // 사업대상 연령
  aply_trgt?: string; // 신청 대상
  aply_trgt_ctnt?: string; // 신청 대상 내용
  aply_mthd_onli_rcpt_istc?: string; // 온라인 접수처
  detl_pg_url?: string; // 상세 페이지 URL
  prch_cnpl_no?: string; // 문의 연락처
  pbanc_rcpt_bgng_dt?: string; // 접수 시작
  pbanc_rcpt_end_dt?: string; // 접수 마감
  sprv_inst?: string; // 주관기관
  biz_prch_dprt_nm?: string; // 사업 담당 부서
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
    console.warn("[kstartup] cache write failed", e);
  }
}

async function fetchPage(
  key: string,
  page: number,
): Promise<{ items: Policy[]; totalCount: number } | null> {
  const url = new URL(LIST_ENDPOINT);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("page", String(page));
  url.searchParams.set("perPage", String(PAGE_SIZE));
  url.searchParams.set("returnType", "json");

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 86400 },
      headers: { "User-Agent": "kor-welfare-hub/0.1" },
    });
    if (res.status === 403) {
      console.warn("[kstartup] 403 — 활용신청 권한 반영 대기 중일 수 있음");
      return null;
    }
    if (!res.ok) {
      console.warn(`[kstartup] HTTP ${res.status}`);
      return null;
    }
    const text = await res.text();
    // 응답이 JSON 또는 XML일 수 있음
    if (text.trim().startsWith("<")) {
      console.warn("[kstartup] received XML — expected JSON, check returnType");
      return null;
    }
    const json = JSON.parse(text);
    const list = (json?.data ?? json?.items ?? []) as KStartupItem[];
    const totalCount = Number(json?.totalCount ?? json?.matchCount ?? 0);
    return { items: list.map(mapKStartup), totalCount };
  } catch (e) {
    console.warn(`[kstartup] fetch failed page ${page}`, e);
    return null;
  }
}

export async function fetchKStartupPolicies(opts: { forceRefresh?: boolean } = {}): Promise<Policy[]> {
  if (!opts.forceRefresh) {
    const cached = await readCache();
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.items;
    if (cached && !process.env.KSTARTUP_API_KEY) return cached.items;
  }

  const key = process.env.KSTARTUP_API_KEY || process.env.BOKJIRO_API_KEY;
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

  console.log(`[kstartup] fetched ${deduped.length}/${first.totalCount} records across ${totalPages} pages`);
  await writeCache(deduped);
  return deduped;
}

function mapKStartup(p: KStartupItem): Policy {
  const today = new Date().toISOString().slice(0, 10);
  const id = String(p.pbanc_sn ?? Math.random().toString(36).slice(2));
  const title = p.biz_pbanc_nm || p.intg_pbanc_biz_nm || "K-Startup 사업공고";
  const agency = p.sprv_inst || p.biz_prch_dprt_nm || "창업진흥원";
  const region = normalizeRegion(p.supt_regin || "전국");
  const summary = (p.pbanc_ctnt || p.aply_trgt_ctnt || "").slice(0, 220);
  const eligibility = [
    p.aply_trgt_ctnt,
    p.biz_trgt_age ? `대상 연령: ${p.biz_trgt_age}` : "",
  ].filter(Boolean).join(" · ");
  const deadline = p.pbanc_rcpt_end_dt
    ? p.pbanc_rcpt_end_dt.length === 8
      ? `${p.pbanc_rcpt_end_dt.slice(0, 4)}-${p.pbanc_rcpt_end_dt.slice(4, 6)}-${p.pbanc_rcpt_end_dt.slice(6)}`
      : p.pbanc_rcpt_end_dt
    : undefined;
  const url = p.detl_pg_url || `https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do`;

  const blob = `${title} ${summary} ${p.supt_biz_clsfc ?? ""} ${p.aply_trgt_ctnt ?? ""}`;

  return {
    id: `kstartup-${id}`,
    title,
    agency,
    level: region === "전국" ? "national" : "metro",
    region,
    category: "startup",
    audience: deriveAudience(blob),
    summary: summary || `${agency} 창업 지원 사업 공고`,
    benefit: summary.slice(0, 150) || "K-Startup 상세 페이지에서 확인",
    eligibility: eligibility || "예비창업자·초기창업자",
    howTo: p.aply_mthd_onli_rcpt_istc || "K-Startup 누리집에서 온라인 접수",
    url,
    source: "curated", // Policy.source 타입에 'kstartup' 없으므로 'curated'로 그룹화
    updatedAt: today,
    deadline,
    tags: ["K-Startup", "창업", ...(p.supt_biz_clsfc ? [p.supt_biz_clsfc] : [])].slice(0, 4),
  };
}

function normalizeRegion(s: string): string {
  if (!s || s === "전국") return "전국";
  const map: Record<string, string> = {
    서울: "서울특별시", 부산: "부산광역시", 대구: "대구광역시", 인천: "인천광역시",
    광주: "광주광역시", 대전: "대전광역시", 울산: "울산광역시", 세종: "세종특별자치시",
    경기: "경기도", 강원: "강원특별자치도", 충북: "충청북도", 충남: "충청남도",
    전북: "전북특별자치도", 전남: "전라남도", 경북: "경상북도", 경남: "경상남도",
    제주: "제주특별자치도",
  };
  for (const k of Object.keys(map)) if (s.includes(k)) return map[k];
  return "전국";
}

function deriveAudience(text: string): string[] {
  const out = new Set<string>(["예비창업자", "초기창업자"]);
  if (/청년|만\s*39|만\s*34|39세|34세/.test(text)) out.add("청년");
  if (/여성/.test(text)) out.add("여성");
  if (/소상공인/.test(text)) out.add("자영업자");
  if (/대학생|학생/.test(text)) out.add("대학생");
  if (/장애/.test(text)) out.add("장애인");
  if (/시니어|중장년|중년/.test(text)) out.add("중장년");
  if (/농업|어업|영농/.test(text)) out.add("청년농업인");
  return Array.from(out);
}
