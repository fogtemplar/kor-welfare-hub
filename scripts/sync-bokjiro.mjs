#!/usr/bin/env node
// One-shot script: fetch ALL 복지로 records and persist to .cache/bokjiro.json
// Usage: BOKJIRO_API_KEY=... node scripts/sync-bokjiro.mjs
//        npm run sync:bokjiro

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENV_PATH = path.join(ROOT, ".env.local");

// Minimal .env.local loader (avoid adding dotenv as a dep)
try {
  const env = await fs.readFile(ENV_PATH, "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* ignore — .env.local optional */
}

const key = process.env.BOKJIRO_API_KEY;
if (!key) {
  console.error("✗ BOKJIRO_API_KEY not set. Add it to .env.local or export it before running.");
  process.exit(1);
}

const ENDPOINT =
  "http://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001";
const PAGE_SIZE = 500;
const MAX_PAGES = 80;
const CONCURRENCY = 4;

async function fetchPage(page) {
  const url = new URL(ENDPOINT);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("callTp", "L");
  url.searchParams.set("pageNo", String(page));
  url.searchParams.set("numOfRows", String(PAGE_SIZE));
  url.searchParams.set("srchKeyCode", "001");
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "kor-welfare-hub-sync/0.1" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}`);
  return res.text();
}

function extractInts(xml, tag) {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`);
  const m = re.exec(xml);
  return m ? Number(m[1]) : 0;
}

function parseItems(xml) {
  const items = [];
  const blocks = xml.match(/<servList>[\s\S]*?<\/servList>/g) ?? [];
  for (const b of blocks) {
    const pick = (t) => {
      const m = new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(b);
      return m ? m[1].trim() : "";
    };
    items.push({
      servId: pick("servId"),
      servNm: pick("servNm"),
      jurMnofNm: pick("jurMnofNm"),
      bizChrDeptNm: pick("bizChrDeptNm"),
      servDgst: pick("servDgst"),
      ctpvNm: pick("ctpvNm"),
      sggNm: pick("sggNm"),
      servDtlLink: pick("servDtlLink"),
      lifeArray: pick("lifeArray"),
      intrsThemaArray: pick("intrsThemaArray"),
      trgterIndvdlArray: pick("trgterIndvdlArray"),
    });
  }
  return items;
}

const REGION_MAP = {
  서울: "서울특별시", 부산: "부산광역시", 대구: "대구광역시", 인천: "인천광역시",
  광주: "광주광역시", 대전: "대전광역시", 울산: "울산광역시", 세종: "세종특별자치시",
  경기: "경기도", 강원: "강원특별자치도", 충북: "충청북도", 충남: "충청남도",
  전북: "전북특별자치도", 전남: "전라남도", 경북: "경상북도", 경남: "경상남도",
  제주: "제주특별자치도",
};
function normalizeRegion(s) {
  if (!s) return "전국";
  for (const k of Object.keys(REGION_MAP)) if (s.startsWith(k)) return REGION_MAP[k];
  return s;
}

function inferCategory(t) {
  if (/(청년|취업청년)/.test(t)) return "youth";
  if (/(주거|전세|월세|임대|주택|청약)/.test(t)) return "housing";
  if (/(출산|임신|육아|아동|보육|어린이집|영유아|돌봄)/.test(t)) return "childcare";
  if (/(취업|일자리|고용|구직|실업|직업훈련)/.test(t)) return "employment";
  if (/(창업|벤처|소상공인)/.test(t)) return "startup";
  if (/(장학|학자금|학교|학습|학생)/.test(t)) return "education";
  if (/(노인|어르신|기초연금|경로)/.test(t)) return "senior";
  if (/장애/.test(t)) return "disability";
  if (/(기초생활|차상위|긴급|저소득|생계)/.test(t)) return "lowincome";
  if (/(의료|건강|병원|진료|예방접종)/.test(t)) return "health";
  if (/(농어업|농업|어업|수산|귀농|영농)/.test(t)) return "farm";
  if (/(문화|여가|체육|관광)/.test(t)) return "culture";
  return "lowincome";
}

function deriveAudience(t) {
  const out = new Set();
  const rules = [
    [/청년/, "청년"], [/노인|어르신/, "노인"], [/아동/, "아동가구"],
    [/영유아|영아/, "영아가구"], [/임산부|임신/, "임산부"], [/출산/, "출산가구"],
    [/장애/, "장애인"], [/한부모|조손/, "한부모"], [/다자녀/, "다자녀"],
    [/다문화|결혼이민|탈북/, "다문화"], [/저소득|기초생활|차상위/, "저소득"],
    [/구직|미취업/, "구직자"], [/근로|재직/, "재직자"], [/창업|벤처/, "예비창업자"],
    [/대학생|학생/, "대학생"], [/무주택|임차/, "무주택자"],
    [/농업|어업|농어민/, "청년농업인"], [/여성|경력단절/, "여성"],
  ];
  for (const [re, tag] of rules) if (re.test(t)) out.add(tag);
  if (out.size === 0) out.add("전국민");
  return [...out];
}

async function main() {
  console.log("→ fetching page 1 to discover totalCount…");
  const first = await fetchPage(1);
  const totalCount = extractInts(first, "totalCount");
  const totalPages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(totalCount / PAGE_SIZE)));
  console.log(`  totalCount=${totalCount}, pages=${totalPages}, page size=${PAGE_SIZE}`);

  const xmls = [first];
  const remaining = [];
  for (let p = 2; p <= totalPages; p++) remaining.push(p);
  for (let i = 0; i < remaining.length; i += CONCURRENCY) {
    const batch = remaining.slice(i, i + CONCURRENCY);
    const got = await Promise.all(batch.map((p) => fetchPage(p)));
    xmls.push(...got);
    process.stdout.write(`  fetched pages ${i + 2}..${Math.min(i + 1 + batch.length, totalPages)} (${xmls.length}/${totalPages})\n`);
  }

  const rawItems = xmls.flatMap(parseItems);
  const today = new Date().toISOString().slice(0, 10);
  const policies = [];
  const seen = new Set();
  for (const r of rawItems) {
    const id = `bokjiro-${r.servId}`;
    if (seen.has(id) || !r.servId || !r.servNm) continue;
    seen.add(id);
    const agency = [r.jurMnofNm, r.bizChrDeptNm].filter(Boolean).join(" · ") || "보건복지부";
    const level = r.sggNm ? "local" : r.ctpvNm ? "metro" : "national";
    const blob = `${r.servNm} ${r.servDgst} ${r.intrsThemaArray} ${r.trgterIndvdlArray} ${r.lifeArray}`;
    const meta = new Set();
    for (const piece of [r.intrsThemaArray, r.lifeArray]) {
      for (const part of piece.split(/[,，·;]/).map((s) => s.trim()).filter(Boolean)) meta.add(part);
    }
    policies.push({
      id,
      title: r.servNm,
      agency,
      level,
      region: normalizeRegion(r.ctpvNm),
      district: r.sggNm || undefined,
      category: inferCategory(blob),
      audience: deriveAudience(blob),
      summary: r.servDgst.slice(0, 220) || `${r.jurMnofNm || "정부"}에서 운영하는 복지서비스입니다.`,
      benefit: "복지로 상세 페이지에서 확인 (지원 내용 다양)",
      eligibility: "복지로 상세 페이지에서 확인",
      howTo: "복지로 누리집 또는 주소지 행정복지센터",
      url:
        r.servDtlLink ||
        `https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52011M.do?wlfareInfoId=${r.servId}`,
      source: "bokjiro",
      updatedAt: today,
      tags: ["복지로", ...[...meta].slice(0, 5)],
    });
  }

  const cacheDir = path.join(ROOT, ".cache");
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(
    path.join(cacheDir, "bokjiro.json"),
    JSON.stringify({ fetchedAt: Date.now(), items: policies }),
    "utf8",
  );
  console.log(`✓ wrote ${policies.length} policies to .cache/bokjiro.json`);
}

main().catch((e) => {
  console.error("✗ sync failed:", e);
  process.exit(1);
});
