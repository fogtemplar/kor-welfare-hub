import type { Policy } from "@/lib/types";

const RSS_URL = "https://www.korea.kr/rss/policy.xml";

export async function fetchKoreaKrPolicyNews(): Promise<Policy[]> {
  try {
    const res = await fetch(RSS_URL, {
      next: { revalidate: 3600 },
      headers: { "User-Agent": "kor-welfare-hub/0.1 (+aggregator)" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssItems(xml).slice(0, 12);
  } catch {
    return [];
  }
}

function parseRssItems(xml: string): Policy[] {
  const items: Policy[] = [];
  const itemRegex = /<item[\s\S]*?<\/item>/g;
  const matches = xml.match(itemRegex) ?? [];
  for (let i = 0; i < matches.length; i++) {
    const block = matches[i];
    const title = pickTag(block, "title");
    const link = pickTag(block, "link");
    const desc = pickTag(block, "description");
    const date = pickTag(block, "pubDate") || pickTag(block, "dc:date");
    if (!title || !link) continue;
    items.push({
      id: `korea-kr-${hash(link)}`,
      title: clean(title),
      agency: "정책브리핑 (korea.kr)",
      level: "national",
      region: "전국",
      category: inferCategory(title + " " + desc),
      audience: ["전국민"],
      summary: clean(desc).slice(0, 160) || "정부 정책 브리핑에서 발표된 최신 소식입니다.",
      benefit: "최신 정책 소식 — 상세는 원문 참조",
      eligibility: "해당 정책 공고문 참조",
      howTo: "원문 링크에서 확인",
      url: clean(link),
      source: "korea_kr",
      updatedAt: toIsoDate(date) ?? new Date().toISOString().slice(0, 10),
      tags: ["정책뉴스"],
    });
  }
  return items;
}

function pickTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  let s = m[1].trim();
  s = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return s;
}

function clean(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function toIsoDate(s: string): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function inferCategory(text: string): Policy["category"] {
  const t = text.toLowerCase();
  if (/(청년|취업|이직|구직)/.test(text)) return "youth";
  if (/(주거|전세|월세|임대|주택|청약)/.test(text)) return "housing";
  if (/(출산|임신|육아|아동|보육|어린이집)/.test(text)) return "childcare";
  if (/(취업|일자리|고용|실업)/.test(text)) return "employment";
  if (/(창업|벤처|스타트업)/.test(text)) return "startup";
  if (/(장학|교육|학자금|학교)/.test(text)) return "education";
  if (/(노인|어르신|기초연금|돌봄)/.test(text)) return "senior";
  if (/(장애|장애인)/.test(text)) return "disability";
  if (/(기초생활|차상위|긴급|저소득)/.test(text)) return "lowincome";
  if (/(의료|건강|병원|진료)/.test(text)) return "health";
  if (/(농어업|농업|어업|수산|귀농)/.test(text)) return "farm";
  return "culture";
}
