import type { LifeStage, Policy } from "@/lib/types";

/**
 * 생애주기(복지로 lifeArray) → 연령 추정.
 *
 * 설계 원칙: 잘못된 연령 제한은 받을 수 있는 정책을 "숨겨버리기" 때문에
 * 놓치는 것보다 해롭다. 그래서 확신도에 따라 두 단계로 나눈다.
 *
 *  - ageMin/ageMax : 본문에 "만 19세~34세" 같이 명시된 경우에만 설정.
 *                    matchPolicy에서 하드 차단(blocker)으로 쓰인다.
 *  - lifeStages    : 생애주기 코드에서 유추한 값. 근사치이므로
 *                    차단하지 않고 가점으로만 쓴다.
 */

export type { LifeStage };

export const LIFE_STAGE_AGES: Record<LifeStage, [number, number]> = {
  infant: [0, 5],
  child: [6, 12],
  teen: [13, 18],
  young: [19, 34],
  middle: [35, 64],
  senior: [65, 120],
};

const STAGE_ALIASES: [RegExp, LifeStage][] = [
  [/영유아|영아|유아/, "infant"],
  [/아동|어린이/, "child"],
  [/청소년/, "teen"],
  [/청년/, "young"],
  [/중장년|장년|중년/, "middle"],
  [/노년|노인|어르신/, "senior"],
];

// 복지로 lifeArray 코드 (숫자로 내려오는 경우)
const STAGE_CODES: Record<string, LifeStage> = {
  "001": "infant",
  "002": "child",
  "003": "teen",
  "004": "young",
  "005": "middle",
  "006": "senior",
};

/** "영유아,아동" / "001,002" 형태를 LifeStage[] 로 변환 */
export function parseLifeStages(raw: string | undefined): LifeStage[] {
  if (!raw) return [];
  const out = new Set<LifeStage>();
  for (const piece of raw.split(/[,，·;|]/).map((s) => s.trim()).filter(Boolean)) {
    const byCode = STAGE_CODES[piece];
    if (byCode) {
      out.add(byCode);
      continue;
    }
    for (const [re, stage] of STAGE_ALIASES) {
      if (re.test(piece)) {
        out.add(stage);
        break;
      }
    }
  }
  return Array.from(out);
}

/** 전 생애주기를 다 포함하면 사실상 제한이 없는 것 → 신호로 쓰지 않는다 */
export function isAllStages(stages: LifeStage[]): boolean {
  return stages.length >= 6;
}

/**
 * 본문에서 명시적 연령 조건을 추출한다. 확신이 서는 표현만 처리하고,
 * 애매하면 undefined를 반환해 차단이 걸리지 않게 한다.
 */
export function extractExplicitAgeRange(
  text: string,
): { ageMin?: number; ageMax?: number } | undefined {
  if (!text) return undefined;
  const t = text.replace(/\s+/g, " ");

  // "만 19세 ~ 34세", "19세~39세", "만 19 ~ 34 세"
  const range = t.match(/만?\s*(\d{1,3})\s*세?\s*[~〜\-–]\s*(\d{1,3})\s*세/);
  if (range) {
    const lo = Number(range[1]);
    const hi = Number(range[2]);
    if (lo < hi && hi <= 120) return { ageMin: lo, ageMax: hi };
  }

  // "만 65세 이상"
  const over = t.match(/만?\s*(\d{1,3})\s*세\s*이상/);
  // "만 18세 미만" / "만 18세 이하"
  const under = t.match(/만?\s*(\d{1,3})\s*세\s*(미만|이하)/);

  if (over && under) {
    const lo = Number(over[1]);
    const hi = Number(under[1]) - (under[2] === "미만" ? 1 : 0);
    if (lo < hi && hi <= 120) return { ageMin: lo, ageMax: hi };
    return undefined;
  }
  if (over) {
    const lo = Number(over[1]);
    if (lo > 0 && lo <= 120) return { ageMin: lo };
  }
  if (under) {
    const hi = Number(under[1]) - (under[2] === "미만" ? 1 : 0);
    if (hi > 0 && hi <= 120) return { ageMax: hi };
  }
  return undefined;
}

/** 사용자 나이가 정책의 생애주기 범위 안에 드는지 */
export function ageFitsStages(age: number, stages: LifeStage[]): boolean {
  return stages.some((s) => {
    const [lo, hi] = LIFE_STAGE_AGES[s];
    return age >= lo && age <= hi;
  });
}

/** 생애주기 → 사람이 읽는 라벨 */
export function stageLabel(s: LifeStage): string {
  return {
    infant: "영유아",
    child: "아동",
    teen: "청소년",
    young: "청년",
    middle: "중장년",
    senior: "노년",
  }[s];
}

/**
 * 스크래퍼 공통 후처리: 명시적 연령 표현이 있으면 하드 조건으로,
 * 생애주기 값이 있으면 소프트 신호로 채운다.
 */
export function enrichAge(
  policy: Policy,
  opts: { lifeRaw?: string; texts: string[] },
): void {
  if (typeof policy.ageMin !== "number" && typeof policy.ageMax !== "number") {
    for (const t of opts.texts) {
      const explicit = extractExplicitAgeRange(t);
      if (explicit) {
        policy.ageMin = explicit.ageMin;
        policy.ageMax = explicit.ageMax;
        break;
      }
    }
  }

  const stages = parseLifeStages(opts.lifeRaw);
  if (stages.length > 0 && !isAllStages(stages)) {
    policy.lifeStages = stages;
  }
}
