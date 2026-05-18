export type PolicyCategory =
  | "youth"
  | "housing"
  | "childcare"
  | "employment"
  | "startup"
  | "education"
  | "senior"
  | "disability"
  | "lowincome"
  | "health"
  | "farm"
  | "culture";

export type PolicyLevel = "national" | "metro" | "local";

export type PolicySource =
  | "curated"
  | "gov24"
  | "bokjiro"
  | "youthcenter"
  | "worknet"
  | "korea_kr";

export type Policy = {
  id: string;
  title: string;
  agency: string;
  level: PolicyLevel;
  region?: string;
  district?: string;
  category: PolicyCategory;
  audience: string[];
  ageMin?: number;
  ageMax?: number;
  incomeMaxPct?: number;
  summary: string;
  benefit: string;
  eligibility: string;
  howTo: string;
  url: string;
  source: PolicySource;
  updatedAt: string;
  deadline?: string;
  isAlwaysOpen?: boolean;
  tags?: string[];
};

export type CategoryMeta = {
  key: PolicyCategory;
  label: string;
  emoji: string;
  description: string;
  color: string;
};

export const CATEGORIES: CategoryMeta[] = [
  {
    key: "youth",
    label: "청년",
    emoji: "🧑",
    description: "청년 자산형성·이직·생활 지원",
    color: "bg-indigo-50 text-indigo-700",
  },
  {
    key: "housing",
    label: "주거",
    emoji: "🏠",
    description: "전월세·청약·대출·임차료",
    color: "bg-emerald-50 text-emerald-700",
  },
  {
    key: "childcare",
    label: "육아",
    emoji: "👶",
    description: "수당·바우처·돌봄",
    color: "bg-rose-50 text-rose-700",
  },
  {
    key: "employment",
    label: "취업",
    emoji: "💼",
    description: "구직·훈련·고용보험",
    color: "bg-sky-50 text-sky-700",
  },
  {
    key: "startup",
    label: "창업",
    emoji: "💡",
    description: "예비창업·자금·공간",
    color: "bg-fuchsia-50 text-fuchsia-700",
  },
  {
    key: "education",
    label: "교육",
    emoji: "🎓",
    description: "장학금·학자금·평생교육",
    color: "bg-amber-50 text-amber-700",
  },
  {
    key: "senior",
    label: "노인",
    emoji: "🧓",
    description: "연금·일자리·돌봄",
    color: "bg-orange-50 text-orange-700",
  },
  {
    key: "disability",
    label: "장애",
    emoji: "♿",
    description: "연금·활동지원·자립",
    color: "bg-teal-50 text-teal-700",
  },
  {
    key: "lowincome",
    label: "긴급·생계",
    emoji: "🤝",
    description: "생계·의료·주거·교육 급여",
    color: "bg-yellow-50 text-yellow-800",
  },
  {
    key: "health",
    label: "의료",
    emoji: "🏥",
    description: "본인부담·재난적의료비",
    color: "bg-pink-50 text-pink-700",
  },
  {
    key: "farm",
    label: "농어업",
    emoji: "🌾",
    description: "영농정착·귀농·수산",
    color: "bg-lime-50 text-lime-700",
  },
  {
    key: "culture",
    label: "문화",
    emoji: "🎟️",
    description: "문화누리·체육·관광",
    color: "bg-violet-50 text-violet-700",
  },
];

export const REGIONS = [
  "전국",
  "서울특별시",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "경기도",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
];
