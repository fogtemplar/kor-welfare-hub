import { promises as fs } from "node:fs";
import path from "node:path";
import type { Policy, PolicyCategory } from "@/lib/types";

// 행정안전부_대한민국 공공서비스(혜택) 정보
// 신청: data.go.kr 검색 "행정안전부 공공서비스 혜택"
// Base: api.odcloud.kr/api
// Path: /gov24/v3/serviceList (JSON)
const LIST_ENDPOINT = "https://api.odcloud.kr/api/gov24/v3/serviceList";

const PAGE_SIZE = 500; // 최대 안전치
const MAX_PAGES = 30; // 안전 캡 (15,000건)
const CONCURRENCY = 4;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "govService.json");

type CacheShape = { fetchedAt: number; items: Policy[] };

type GovServiceItem = {
  서비스ID: string;
  지원유형: string;
  서비스명: string;
  서비스목적요약: string;
  지원대상: string;
  선정기준: string;
  지원내용: string;
  신청방법: string;
  신청기한: string;
  상세조회URL: string;
  소관기관코드: string;
  소관기관명: string;
  부서명: string;
  소관기관유형: string;
  사용자구분: string;
  서비스분야: string;
  접수기관: string;
  전화문의: string;
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
    console.warn("[govService] cache write failed", e);
  }
}

async function fetchPage(
  key: string,
  page: number,
): Promise<{ items: GovServiceItem[]; totalCount: number } | null> {
  const url = new URL(LIST_ENDPOINT);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("page", String(page));
  url.searchParams.set("perPage", String(PAGE_SIZE));
  url.searchParams.set("returnType", "JSON");

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: { "User-Agent": "kor-welfare-hub/0.1" },
    });
    if (!res.ok) {
      console.warn(`[govService] HTTP ${res.status} page ${page}`);
      return null;
    }
    const json = await res.json();
    const list = (json?.data ?? []) as GovServiceItem[];
    const totalCount = Number(json?.totalCount ?? 0);
    return { items: list, totalCount };
  } catch (e) {
    console.warn(`[govService] fetch failed page ${page}`, e);
    return null;
  }
}

export async function fetchGovServicePolicies(opts: { forceRefresh?: boolean } = {}): Promise<Policy[]> {
  if (!opts.forceRefresh) {
    const cached = await readCache();
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.items;
    if (cached && !process.env.GOV_SERVICE_API_KEY && !process.env.BOKJIRO_API_KEY) return cached.items;
  }

  const key = process.env.GOV_SERVICE_API_KEY || process.env.BOKJIRO_API_KEY;
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

  const rawAll: GovServiceItem[] = [...first.items];
  if (totalPages > 1) {
    const remaining: number[] = [];
    for (let p = 2; p <= totalPages; p++) remaining.push(p);
    for (let i = 0; i < remaining.length; i += CONCURRENCY) {
      const batch = remaining.slice(i, i + CONCURRENCY);
      const got = await Promise.all(batch.map((p) => fetchPage(key, p)));
      for (const r of got) if (r) rawAll.push(...r.items);
    }
  }

  // 필터 제거 — AI가 매칭 시 자동 정렬. 안전성 체크만 (ID/제목 없는 항목 제외)
  const filtered = rawAll.filter((s) => s.서비스ID && s.서비스명);

  const mapped = filtered.map(mapGovService);

  const seen = new Set<string>();
  const deduped: Policy[] = [];
  for (const p of mapped) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    deduped.push(p);
  }

  console.log(
    `[govService] fetched ${deduped.length} / ${first.totalCount} (안전 필터 ${rawAll.length - filtered.length}건 제거)`,
  );
  await writeCache(deduped);
  return deduped;
}

// 혜택성 + 개인/가구 대상 판정
function isBenefitForIndividual(s: GovServiceItem): boolean {
  // 1. 사용자구분: "개인" 또는 "가구" 포함 필수
  const userTypes = s.사용자구분 || "";
  const hasIndividual = userTypes.includes("개인") || userTypes.includes("가구");
  if (!hasIndividual) return false;

  // 2. 지원유형: 혜택성 유형만 통과 (가장 강한 필터)
  //    재난·고유가·긴급지원금은 "행정·안전" 분야지만 지원유형이 "현금/현물"이면 진짜 혜택임
  const supType = s.지원유형 || "";
  const benefitKinds = [
    "현금",
    "현물",
    "이용권",
    "서비스",
    "기타(교육)",
    "기타(상담)",
    "기타(돌봄)",
    "기타(법률)",
    "기타(주거)",
    "기타(의료)",
  ];
  const isBenefit = benefitKinds.some((k) => supType.includes(k));
  if (!isBenefit) return false;

  // 3. 제목이 단순 행정·민원·증명인 경우 제외
  const adminPattern = /(신고\s*$|^.{1,20}\s*신고\s|증명서?\s*발급|확인서?\s*발급|등록\s*신청|민원\s|증명서|이의신청|불복신청)/;
  if (adminPattern.test(s.서비스명 || "")) return false;

  return true;
}

function mapGovService(s: GovServiceItem): Policy {
  const today = new Date().toISOString().slice(0, 10);
  const region = inferRegion(s.소관기관명, s.소관기관유형, s.부서명);
  const level: Policy["level"] =
    s.소관기관유형?.includes("중앙") ? "national" : s.소관기관유형?.includes("시군구") ? "local" : "metro";
  const agency = s.부서명 ? `${s.소관기관명} · ${s.부서명}` : s.소관기관명 || "행정안전부";
  const blob = `${s.서비스명} ${s.서비스목적요약} ${s.지원대상} ${s.서비스분야}`;

  return {
    id: `gov24-${s.서비스ID}`,
    title: s.서비스명,
    agency,
    level,
    region,
    category: inferCategory(s.서비스분야, blob),
    audience: deriveAudience(s.사용자구분, blob, s.지원대상),
    summary: (s.서비스목적요약 || s.지원내용 || "").slice(0, 220),
    benefit: (s.지원내용 || "정부24 상세 페이지에서 확인").slice(0, 200),
    eligibility: (s.지원대상 || s.선정기준 || "정부24 상세 페이지 참조").slice(0, 250),
    howTo: (s.신청방법 || "정부24에서 온라인 신청 또는 주소지 행정복지센터").slice(0, 200),
    url: s.상세조회URL || `https://www.gov.kr/portal/rcvfvrSvc/dtlEx/${s.서비스ID}`,
    source: "gov24",
    updatedAt: today,
    isAlwaysOpen: s.신청기한?.includes("상시") ? true : undefined,
    tags: ["정부24", s.서비스분야, s.지원유형].filter(Boolean).slice(0, 4),
  };
}

function inferRegion(orgName: string, orgType: string, deptName: string): string {
  const all = `${orgName} ${deptName} ${orgType}`;
  const map: Record<string, string> = {
    서울: "서울특별시", 부산: "부산광역시", 대구: "대구광역시", 인천: "인천광역시",
    광주: "광주광역시", 대전: "대전광역시", 울산: "울산광역시", 세종: "세종특별자치시",
    경기: "경기도", 강원: "강원특별자치도", 충북: "충청북도", 충남: "충청남도",
    전북: "전북특별자치도", 전남: "전라남도", 경북: "경상북도", 경남: "경상남도",
    제주: "제주특별자치도",
  };
  for (const k of Object.keys(map)) if (all.includes(k)) return map[k];
  return "전국";
}

function inferCategory(field: string, text: string): PolicyCategory {
  const f = field || "";
  // 행정·안전 분야는 보통 재난·긴급·민방위인데, 우리 통과 항목은 혜택성(현금·현물) → lowincome
  if (f.includes("행정·안전")) {
    if (/재난|긴급|피해|고유가|유가|위기/.test(text)) return "lowincome";
    if (/문화|관광|체육/.test(text)) return "culture";
    return "lowincome";
  }
  if (f.includes("주거")) return "housing";
  if (f.includes("임신") || f.includes("출산")) return "childcare";
  if (f.includes("보육·교육") || f.includes("교육")) {
    if (/아동|영유아|어린이집|유치원|보육/.test(text)) return "childcare";
    return "education";
  }
  if (f.includes("고용") || f.includes("일자리") || f.includes("취업")) return "employment";
  if (f.includes("창업")) return "startup";
  if (f.includes("보건") || f.includes("의료")) return "health";
  if (f.includes("농림") || f.includes("축산") || f.includes("어업")) return "farm";
  if (f.includes("문화") || f.includes("환경") || f.includes("관광")) return "culture";
  if (f.includes("보호") || f.includes("돌봄")) {
    if (/노인|어르신/.test(text)) return "senior";
    if (/장애/.test(text)) return "disability";
    if (/아동|영유아/.test(text)) return "childcare";
    return "lowincome";
  }
  if (f.includes("생활안정") || f.includes("자립")) return "lowincome";
  // 텍스트 fallback
  if (/(청년)/.test(text)) return "youth";
  if (/(노인|어르신)/.test(text)) return "senior";
  if (/(장애)/.test(text)) return "disability";
  if (/(저소득|기초생활|차상위)/.test(text)) return "lowincome";
  return "lowincome";
}

function deriveAudience(userType: string, blob: string, target: string): string[] {
  const out = new Set<string>();
  const all = `${userType} ${blob} ${target}`;
  const rules: [RegExp, string][] = [
    [/청년/, "청년"],
    [/노인|어르신/, "노인"],
    [/아동|영유아|어린이/, "아동가구"],
    [/임산부|임신/, "임산부"],
    [/출산/, "출산가구"],
    [/장애/, "장애인"],
    [/한부모|조손/, "한부모"],
    [/다자녀/, "다자녀"],
    [/다문화|결혼이민|탈북/, "다문화"],
    [/저소득|기초생활|차상위/, "저소득"],
    [/구직|미취업|실업/, "구직자"],
    [/근로자|재직/, "재직자"],
    [/창업|소상공인/, "예비창업자"],
    [/대학생|학생/, "대학생"],
    [/무주택|임차|월세|전세/, "무주택자"],
    [/여성|경력단절/, "여성"],
    [/농업|어업|농어민/, "농업인"],
    [/국가유공자|보훈/, "국가유공자"],
  ];
  for (const [re, tag] of rules) if (re.test(all)) out.add(tag);
  if (out.size === 0) out.add("전국민");
  return Array.from(out);
}
