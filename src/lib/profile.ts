import type { Policy } from "@/lib/types";

export type Gender = "female" | "male" | "na";
export type Household =
  | "single"
  | "couple"
  | "newlywed"
  | "general"
  | "multi-child"
  | "single-parent"
  | "multicultural";
export type Housing = "own" | "jeonse" | "monthly" | "homeless" | "with-family";
export type Status =
  | "student"
  | "jobseeker"
  | "employed"
  | "self-employed"
  | "preparing-startup"
  | "farmer"
  | "retired"
  | "career-break"
  | "none";

export type Profile = {
  age?: number;
  gender?: Gender;
  region?: string;
  household?: Household;
  status?: Status[];
  housing?: Housing;
  childrenAges?: number[];
  pregnant?: boolean;
  hasDisability?: boolean;
  incomePct?: number;
};

export const EMPTY_PROFILE: Profile = {
  region: "전국",
  status: [],
};

export const PROFILE_STORAGE_KEY = "kor-welfare-hub:profile:v1";

export function loadProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(p));
}

export function clearProfile() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PROFILE_STORAGE_KEY);
}

export function isProfileSet(p: Profile | null | undefined): boolean {
  if (!p) return false;
  return (
    typeof p.age === "number" ||
    !!p.household ||
    !!p.housing ||
    (p.status?.length ?? 0) > 0 ||
    typeof p.incomePct === "number" ||
    !!p.hasDisability ||
    !!p.pregnant
  );
}

export type MatchResult = {
  score: number;
  reasons: string[];
  blockers: string[];
};

// 정책 제목·요약에서 명백히 부적합한 패턴 차단 (API 데이터의 ageMin/audience 누락 보완)
type ExcludeRule = {
  pattern: RegExp;
  exclude: (p: Profile) => boolean;
  reason: string;
};

const TITLE_EXCLUDE: ExcludeRule[] = [
  // 시설·기관·종사자 대상 (일반 개인 사용자 대상 X)
  {
    pattern: /(종사자|직원|기관\s*지원|시설\s*기능|시설\s*보수|단체\s*보조|법인\s*지원|사회복지\s*시설|보육\s*시설|어린이집\s*지원)/,
    exclude: () => true,
    reason: "기관·시설·종사자 대상",
  },
  // 신혼부부 전용
  {
    pattern: /신혼부부|예비\s*신혼|혼인\s*7년|신혼\s*특례/,
    exclude: (p) => p.household !== "newlywed",
    reason: "신혼부부 대상",
  },
  // 어린이·청소년·학생 대상 (자녀 없으면 X)
  {
    pattern: /(어린이|영유아|아동\s*수당|청소년|미성년|초등|중등|고등)/,
    exclude: (p) => (p.childrenAges?.length ?? 0) === 0 && !p.pregnant,
    reason: "자녀 양육·임신 가구 대상",
  },
  // 출산·임신·육아휴직
  {
    pattern: /(육아휴직|출산휴가|산전후|아빠\s*육아|모성\s*보호|영아\s*수당|부모\s*급여)/,
    exclude: (p) => (p.childrenAges?.length ?? 0) === 0 && !p.pregnant,
    reason: "임신·영유아 가구 대상",
  },
  // 청년 전용
  {
    pattern: /청년/,
    exclude: (p) => typeof p.age === "number" && (p.age < 18 || p.age > 39),
    reason: "청년 대상 (만 19~39세)",
  },
  // 노인 전용
  {
    pattern: /(노인|어르신|기초연금|경로|독거\s*노인|장기요양)/,
    exclude: (p) => typeof p.age === "number" && p.age < 60,
    reason: "노인 대상 (만 60세 이상)",
  },
  // 대학생·학자금
  {
    pattern: /(대학생|학자금|장학금|등록금|국가장학)/,
    exclude: (p) => !p.status?.includes("student") && (typeof p.age !== "number" || p.age > 30),
    reason: "대학(원)생 대상",
  },
  // 보훈
  {
    pattern: /(보훈|국가유공자|독립유공자|참전유공자|상이군경)/,
    exclude: () => true,
    reason: "국가유공자 대상",
  },
  // 장애인 전용 (혜택)
  {
    pattern: /(장애인\s*연금|장애\s*수당|장애인\s*활동\s*지원|장애\s*아동\s*수당|장애인\s*일자리)/,
    exclude: (p) => !p.hasDisability,
    reason: "등록 장애인 대상",
  },
  // 한부모
  {
    pattern: /(한부모|조손|미혼모|미혼부)/,
    exclude: (p) => p.household !== "single-parent",
    reason: "한부모·조손 가구 대상",
  },
  // 다문화
  {
    pattern: /(다문화|결혼\s*이민|북한\s*이탈|탈북)/,
    exclude: (p) => p.household !== "multicultural",
    reason: "다문화 가구 대상",
  },
  // 농어업
  {
    pattern: /(농업인|어업인|영농|영어\s*정착|귀농|면세\s*유)/,
    exclude: (p) => !p.status?.includes("farmer"),
    reason: "농어업인 대상",
  },
  // 노숙인·쪽방
  {
    pattern: /(노숙인|쪽방\s*촌|시설\s*입소)/,
    exclude: (p) => p.housing !== "homeless",
    reason: "노숙·주거 위기 대상",
  },
  // 임산부
  {
    pattern: /(임산부|임신\s*확인|산모|모자\s*보건)/,
    exclude: (p) => !p.pregnant,
    reason: "임산부 대상",
  },
];

export function matchPolicy(policy: Policy, profile: Profile): MatchResult {
  const reasons: string[] = [];
  const blockers: string[] = [];
  let score = 0;

  // 제목 기반 강한 차단 (가장 먼저)
  for (const rule of TITLE_EXCLUDE) {
    if (rule.pattern.test(policy.title) && rule.exclude(profile)) {
      blockers.push(rule.reason);
    }
  }

  const childcareAge = policy.category === "childcare";
  const candidateAges: number[] = childcareAge
    ? profile.childrenAges ?? []
    : typeof profile.age === "number"
      ? [profile.age]
      : [];

  if (
    candidateAges.length > 0 &&
    (typeof policy.ageMin === "number" || typeof policy.ageMax === "number")
  ) {
    const lo = policy.ageMin ?? 0;
    const hi = policy.ageMax ?? 120;
    const fits = candidateAges.some((a) => a >= lo && a <= hi);
    if (!fits) {
      blockers.push(
        childcareAge
          ? `자녀 만 ${lo}~${hi}세 대상`
          : `만 ${lo}~${hi}세 대상 (현재 ${profile.age}세)`,
      );
    } else {
      score += 25;
      reasons.push(
        childcareAge
          ? `자녀 연령 충족 (${lo}~${hi}세)`
          : `연령 충족 (${lo}~${hi}세)`,
      );
    }
  }

  const region = profile.region ?? "전국";
  if (region !== "전국" && policy.region && policy.region !== "전국") {
    if (policy.region === region) {
      score += 25;
      reasons.push(`지역 일치 (${policy.region})`);
    } else {
      blockers.push(`${policy.region} 거주자 대상`);
    }
  } else if (region !== "전국" && (!policy.region || policy.region === "전국")) {
    score += 8;
    reasons.push("전국 단위 지원");
  }

  if (
    typeof profile.incomePct === "number" &&
    typeof policy.incomeMaxPct === "number"
  ) {
    if (profile.incomePct <= policy.incomeMaxPct) {
      score += 15;
      reasons.push(`소득 조건 충족 (중위 ${policy.incomeMaxPct}% 이하)`);
    } else {
      blockers.push(`중위소득 ${policy.incomeMaxPct}% 이하 대상`);
    }
  }

  const tokens = deriveTokens(profile);
  let audienceHits = 0;
  for (const tag of policy.audience) {
    if (tokens.includes(tag)) {
      audienceHits++;
      reasons.push(`대상 적합 (${tag})`);
    }
  }
  score += Math.min(45, audienceHits * 15);

  if (policy.tags) {
    for (const t of policy.tags) {
      if (tokens.some((tok) => t.includes(tok) || tok.includes(t))) {
        score += 3;
      }
    }
  }

  if (score === 0 && blockers.length === 0) score = 5;
  if (score > 100) score = 100;

  return { score, reasons, blockers };
}

export function deriveTokens(p: Profile): string[] {
  const out = new Set<string>(["전국민"]);

  if (typeof p.age === "number") {
    if (p.age >= 19 && p.age <= 34) out.add("청년");
    if (p.age >= 18 && p.age <= 40) out.add("청년농업인");
    if (p.age >= 65) out.add("노인");
    if (p.age >= 18 && p.age <= 24) out.add("대학생");
    if (p.age === 19) out.add("19세");
  }

  if (p.gender === "female") out.add("여성");

  switch (p.household) {
    case "single":
      out.add("1인가구");
      break;
    case "newlywed":
      out.add("신혼");
      out.add("예비부부");
      break;
    case "multi-child":
      out.add("다자녀");
      break;
    case "single-parent":
      out.add("한부모");
      break;
    case "multicultural":
      out.add("다문화");
      out.add("결혼이민자");
      break;
  }

  if (p.housing === "jeonse" || p.housing === "monthly" || p.housing === "homeless") {
    out.add("무주택자");
    out.add("임차가구");
  }

  if (p.childrenAges && p.childrenAges.length > 0) {
    out.add("아동가구");
    if (p.childrenAges.some((a) => a <= 1)) {
      out.add("영아가구");
      out.add("출산가구");
    }
    if (p.childrenAges.length >= 2) out.add("다자녀");
  }

  if (p.pregnant) {
    out.add("임산부");
    out.add("출산가구");
  }

  if (p.hasDisability) {
    out.add("장애인");
    out.add("중증장애인");
  }

  for (const s of p.status ?? []) {
    switch (s) {
      case "student":
        out.add("대학생");
        out.add("대학원생");
        break;
      case "jobseeker":
        out.add("구직자");
        break;
      case "employed":
        out.add("재직자");
        out.add("근로자");
        break;
      case "self-employed":
        out.add("자영업자");
        break;
      case "preparing-startup":
        out.add("예비창업자");
        out.add("초기창업자");
        break;
      case "farmer":
        out.add("청년농업인");
        break;
      case "retired":
        out.add("퇴직자");
        break;
      case "career-break":
        out.add("경력단절");
        if (p.gender !== "male") out.add("여성");
        break;
    }
  }

  if (typeof p.incomePct === "number") {
    if (p.incomePct <= 75) out.add("저소득");
    if (p.incomePct <= 60) out.add("위기가구");
  }

  return Array.from(out);
}
