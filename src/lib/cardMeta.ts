import type { Policy } from "@/lib/types";

/**
 * 정책 카드에 표시할 메타 정보 자동 추출
 * - 예상 수령액 (benefit에서 "X만원" 패턴 탐색)
 * - 신청 난이도 (eligibility 길이 기반)
 * - 신청 소요시간 (howTo 키워드 기반)
 * - HOT 여부 (updatedAt 최근)
 */

export type CardMeta = {
  amount?: string; // "월 20만원" / "최대 100만원" / undefined
  difficulty: "쉬움" | "보통" | "까다로움";
  applyTime: string; // "5분 (온라인)" / "30분 (방문)"
  isHot: boolean; // 신청기한 임박 OR 신규 정책
};

const AMOUNT_PATTERNS = [
  /(월\s*최대\s*[\d,.]+\s*만\s*원)/,
  /(월\s*[\d,.]+\s*만\s*원)/,
  /(최대\s*[\d,.]+\s*억\s*원)/,
  /(최대\s*[\d,.]+\s*만\s*원)/,
  /(연\s*[\d,.]+\s*만\s*원)/,
  /([\d,.]+\s*억\s*원)/,
  /([\d,.]+\s*만\s*원)/,
];

export function getCardMeta(p: Policy): CardMeta {
  return {
    amount: extractAmount(p.benefit) || extractAmount(p.summary),
    difficulty: estimateDifficulty(p),
    applyTime: estimateApplyTime(p.howTo),
    isHot: isDeadlineSoon(p.deadline),
  };
}

function extractAmount(text: string): string | undefined {
  if (!text) return undefined;
  for (const re of AMOUNT_PATTERNS) {
    const m = text.match(re);
    if (m) return m[1].replace(/\s+/g, " ").trim();
  }
  return undefined;
}

function estimateDifficulty(p: Policy): "쉬움" | "보통" | "까다로움" {
  const eligibility = p.eligibility || "";
  const len = eligibility.length;
  const conditions = (eligibility.match(/[·,，、]/g) || []).length;

  if (p.isAlwaysOpen && len < 60) return "쉬움";
  if (len > 200 || conditions >= 5) return "까다로움";
  if (len > 100 || conditions >= 2) return "보통";
  return "쉬움";
}

function estimateApplyTime(howTo: string): string {
  const h = howTo || "";
  if (/온라인|누리집|앱|모바일|홈택스|복지로\s*누리집|정부24/.test(h) && !/방문/.test(h)) {
    return "약 5분 (온라인)";
  }
  if (/온라인.*방문|방문.*온라인/.test(h)) {
    return "약 10분 (혼합)";
  }
  if (/방문|행정복지센터|읍면동|주민센터|지사/.test(h)) {
    return "약 30분 (방문)";
  }
  return "5분~";
}

function isDeadlineSoon(deadline?: string): boolean {
  // 마감일이 명시되어 있고 14일 이내일 때만 HOT
  if (!deadline) return false;
  try {
    const d = new Date(deadline);
    if (Number.isNaN(d.getTime())) return false;
    const days = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 14;
  } catch {
    return false;
  }
}
