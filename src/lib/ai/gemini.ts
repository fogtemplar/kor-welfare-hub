import type { Policy } from "@/lib/types";
import type { Profile } from "@/lib/profile";

// 모델 우선순위: 환경변수 > 기본값
// 사용 가능한 모델: gemini-2.5-flash, gemini-2.0-flash, gemini-flash-latest
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export type AIPick = {
  policyId: string;
  reason: string;
};

export type AIRecommendation = {
  profile: Partial<Profile>;
  picks: AIPick[];
  summary: string;
  followUp?: string;
};

const PROFILE_EXTRACT_SCHEMA = {
  type: "OBJECT",
  properties: {
    age: { type: "NUMBER", nullable: true, description: "만 나이 (없으면 null)" },
    gender: { type: "STRING", enum: ["female", "male", "na"], nullable: true },
    region: {
      type: "STRING",
      nullable: true,
      description: "거주 시·도 (예: '서울특별시', '경기도'). 정확히 17개 광역명 중 하나 또는 '전국'",
    },
    household: {
      type: "STRING",
      enum: ["single", "couple", "newlywed", "general", "multi-child", "single-parent", "multicultural"],
      nullable: true,
    },
    housing: {
      type: "STRING",
      enum: ["own", "jeonse", "monthly", "homeless", "with-family"],
      nullable: true,
    },
    status: {
      type: "ARRAY",
      items: {
        type: "STRING",
        enum: ["student", "jobseeker", "employed", "self-employed", "preparing-startup", "farmer", "retired", "career-break"],
      },
      nullable: true,
    },
    childrenAges: {
      type: "ARRAY",
      items: { type: "NUMBER" },
      nullable: true,
      description: "자녀 나이 목록 (만 나이). 없으면 빈 배열",
    },
    pregnant: { type: "BOOLEAN", nullable: true },
    hasDisability: { type: "BOOLEAN", nullable: true },
    incomePct: {
      type: "NUMBER",
      nullable: true,
      description: "추정 가구 중위소득 % (50, 75, 100, 150, 250 중 하나). 모르면 null",
    },
  },
};

const PICKS_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: {
      type: "STRING",
      description: "사용자 상황을 한 문장으로 요약 (예: '서울 거주 30세 1인가구, 최근 실직')",
    },
    picks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          policyId: { type: "STRING" },
          reason: { type: "STRING", description: "왜 이 정책이 적합한지 한 문장 (50자 이내)" },
        },
        required: ["policyId", "reason"],
      },
    },
    followUp: {
      type: "STRING",
      nullable: true,
      description: "추가로 알면 더 정확해질 정보 1~2개 질문 (선택)",
    },
  },
  required: ["summary", "picks"],
};

const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];

async function callGemini(prompt: string, schema: object): Promise<any> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: schema,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
  };

  const modelsToTry = [MODEL, ...FALLBACK_MODELS.filter((m) => m !== MODEL)];
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    try {
      const res = await fetch(`${endpoint}?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 404) {
        console.warn(`[gemini] model ${model} not available, trying next…`);
        continue;
      }
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[gemini:${model}] non-OK:`, res.status, errText.slice(0, 200));
        lastError = new Error(`Gemini API ${res.status}`);
        if (res.status === 429) throw lastError; // quota는 fallback해도 같은 결과
        continue;
      }

      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        console.error("[gemini] no text:", JSON.stringify(json).slice(0, 200));
        lastError = new Error("Gemini empty response");
        continue;
      }

      try {
        return JSON.parse(text);
      } catch {
        console.error("[gemini] JSON parse fail:", text.slice(0, 200));
        lastError = new Error("Gemini invalid JSON");
        continue;
      }
    } catch (e: any) {
      lastError = e;
      if (e.message?.includes("429")) throw e;
    }
  }

  throw lastError ?? new Error("All Gemini models failed");
}

export async function extractProfile(userText: string): Promise<Partial<Profile>> {
  const prompt = `당신은 한국 복지정책 추천 어시스턴트입니다.
다음 사용자 문장에서 복지정책 매칭에 필요한 정보를 추출하세요.
명시되지 않은 값은 null로 두세요. 추측하지 마세요.

사용자 입력:
"""
${userText}
"""

지역은 정확히 다음 중 하나여야 합니다:
서울특별시, 부산광역시, 대구광역시, 인천광역시, 광주광역시, 대전광역시, 울산광역시, 세종특별자치시, 경기도, 강원특별자치도, 충청북도, 충청남도, 전북특별자치도, 전라남도, 경상북도, 경상남도, 제주특별자치도, 전국

household 매핑:
- "혼자 산다", "1인가구" → single
- "신혼", "결혼한 지 얼마 안 됨" → newlywed
- "한부모", "이혼", "사별" → single-parent
- "다자녀", "아이가 셋 이상" → multi-child
- "다문화", "결혼이민" → multicultural

소득 추정: "어렵다", "기초생활" → 50, "저소득" → 75, "보통" → 100, "여유" → 150+
`;

  return callGemini(prompt, PROFILE_EXTRACT_SCHEMA);
}

export async function pickPolicies(
  userText: string,
  candidates: Policy[],
): Promise<{ summary: string; picks: AIPick[]; followUp?: string }> {
  const compressed = candidates
    .map(
      (p) =>
        `${p.id}|${p.title}|${p.category}|${p.audience.slice(0, 3).join(",")}|${
          p.ageMin ?? "-"
        }~${p.ageMax ?? "-"}|${p.region ?? "전국"}|${p.summary.slice(0, 80).replace(/\|/g, " ")}`,
    )
    .join("\n");

  const prompt = `당신은 한국 복지정책 추천 어시스턴트입니다.
사용자 상황에 가장 적합한 정책 5~10건을 아래 후보 목록에서 골라주세요.

사용자 입력:
"""
${userText}
"""

후보 정책 목록 (ID|제목|카테고리|대상|연령|지역|요약):
${compressed}

규칙:
1. 후보 목록의 ID만 사용 (목록에 없는 정책 만들지 마세요)
2. 사용자 상황과 직접 관련된 것만 선택
3. 각 선택에 짧고 구체적인 이유 (50자 이내)
4. 절박도 높은 것부터 (마감 임박·생계 직결 우선)
5. 부족한 정보 있으면 followUp으로 1~2개 추가 질문 (선택)`;

  return callGemini(prompt, PICKS_SCHEMA);
}

const COMBINED_SCHEMA = {
  type: "OBJECT",
  properties: {
    profile: PROFILE_EXTRACT_SCHEMA,
    summary: { type: "STRING" },
    picks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          policyId: { type: "STRING" },
          reason: { type: "STRING" },
        },
        required: ["policyId", "reason"],
      },
    },
    followUp: { type: "STRING", nullable: true },
  },
  required: ["profile", "summary", "picks"],
};

export async function recommend(
  userText: string,
  allPolicies: Policy[],
): Promise<AIRecommendation> {
  // 빠른 키워드 기반 사전 필터링 (catalog 크기 줄이기)
  const tokens = userText.toLowerCase();
  const keywords: [RegExp, string[]][] = [
    [/청년|이십대|삼십대|20대|30대/, ["youth", "employment", "housing"]],
    [/주거|월세|전세|집|임대|보증금/, ["housing"]],
    [/임신|출산|아기|영아|아이|육아|보육|어린이/, ["childcare"]],
    [/취업|구직|실직|이직|일자리/, ["employment"]],
    [/창업|사업/, ["startup"]],
    [/장학|학자금|대학|학생/, ["education"]],
    [/노인|어르신|기초연금|돌봄/, ["senior"]],
    [/장애|장애인/, ["disability"]],
    [/저소득|기초생활|차상위|긴급|생계/, ["lowincome", "health"]],
    [/의료|병원|치료|건강/, ["health"]],
    [/농업|어업|귀농/, ["farm"]],
    [/문화|체육|관광/, ["culture"]],
  ];
  const focusCats = new Set<string>();
  for (const [re, cats] of keywords) if (re.test(tokens)) cats.forEach((c) => focusCats.add(c));

  let candidates = allPolicies;
  if (focusCats.size > 0) {
    candidates = allPolicies.filter((p) => focusCats.has(p.category));
  }
  // 너무 적으면 전체에서 보충
  if (candidates.length < 30) {
    candidates = [...candidates, ...allPolicies.filter((p) => !candidates.includes(p))].slice(0, 80);
  }
  // 너무 많으면 잘라냄 (앞에서)
  candidates = candidates.slice(0, 80);

  const compressed = candidates
    .map(
      (p) =>
        `${p.id}|${p.title}|${p.category}|${p.audience.slice(0, 3).join(",")}|${
          p.ageMin ?? "-"
        }~${p.ageMax ?? "-"}|${p.region ?? "전국"}`,
    )
    .join("\n");

  const prompt = `당신은 한국 복지정책 추천 어시스턴트입니다.
다음 두 작업을 동시에 수행하세요:

1) 사용자 입력에서 프로필 정보를 추출
2) 후보 정책 중 가장 적합한 5~8건을 선정 + 이유 설명

사용자 입력:
"""
${userText}
"""

후보 정책 (ID|제목|카테고리|대상|연령|지역):
${compressed}

규칙:
- 후보 목록의 정확한 ID만 사용 (목록에 없는 정책 만들지 마세요)
- 직접 관련된 것만 선택. 억지로 추천 X
- 각 선택에 50자 이내 구체적 이유
- 절박도 높은 것부터 (생계 직결 우선)
- 부족한 정보 있으면 followUp으로 1~2문장 추가 질문 (선택)
- 명시되지 않은 프로필 값은 null로 두세요

지역 정규화: "서울"→"서울특별시", "경기"→"경기도" 등 17개 광역명 또는 "전국"`;

  const result = await callGemini(prompt, COMBINED_SCHEMA);

  return {
    profile: result.profile ?? {},
    picks: result.picks ?? [],
    summary: result.summary ?? "",
    followUp: result.followUp ?? undefined,
  };
}
