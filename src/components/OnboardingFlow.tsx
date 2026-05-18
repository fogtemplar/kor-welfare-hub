"use client";

import { useState } from "react";
import type { Policy } from "@/lib/types";
import { REGIONS } from "@/lib/types";
import { PolicyCard } from "./PolicyCard";
import {
  type Profile,
  type Gender,
  type Household,
  type Status,
  matchPolicy,
  saveProfile,
} from "@/lib/profile";

type Step = "age" | "gender" | "region" | "situation" | "interest" | "result";

type Interest =
  | "housing"
  | "lowincome"
  | "employment"
  | "startup"
  | "childcare"
  | "education"
  | "health"
  | "senior"
  | "disability"
  | "culture"
  | "farm";

const INTERESTS: { key: Interest; label: string }[] = [
  { key: "housing", label: "주거 (월세·전세)" },
  { key: "lowincome", label: "생계·긴급" },
  { key: "employment", label: "취업·일자리" },
  { key: "startup", label: "창업·소상공인" },
  { key: "childcare", label: "임신·출산·육아" },
  { key: "education", label: "교육·장학" },
  { key: "health", label: "의료·건강" },
  { key: "senior", label: "노인" },
  { key: "disability", label: "장애" },
  { key: "culture", label: "문화·여가" },
  { key: "farm", label: "농어업" },
];

const AGE_BUCKETS = [
  { label: "10대", min: 13, max: 19 },
  { label: "20대", min: 20, max: 29 },
  { label: "30대", min: 30, max: 39 },
  { label: "40대", min: 40, max: 49 },
  { label: "50대", min: 50, max: 59 },
  { label: "60대", min: 60, max: 69 },
  { label: "70대 이상", min: 70, max: 100 },
];

const SITUATIONS: { key: string; label: string }[] = [
  { key: "single", label: "1인가구" },
  { key: "newlywed", label: "신혼" },
  { key: "multi-child", label: "다자녀" },
  { key: "single-parent", label: "한부모" },
  { key: "multicultural", label: "다문화" },
  { key: "pregnant", label: "임신 중" },
  { key: "child", label: "어린 자녀 있음" },
  { key: "jobseeker", label: "구직 중" },
  { key: "employed", label: "직장인" },
  { key: "preparing-startup", label: "창업 준비" },
  { key: "student", label: "학생" },
  { key: "homeless", label: "주거 불안정" },
  { key: "lowincome", label: "저소득" },
  { key: "disability", label: "장애" },
];

const STEP_TITLES: Record<Step, string> = {
  age: "몇 살이세요?",
  gender: "성별을 알려주세요",
  region: "어디 살고 계세요?",
  situation: "어떤 상황이신가요?",
  interest: "어떤 도움이 필요해요?",
  result: "",
};

const STEP_HINTS: Record<Step, string> = {
  age: "받을 수 있는 혜택이 나이마다 달라요",
  gender: "선택하지 않으셔도 괜찮아요",
  region: "지역별 혜택을 챙겨드릴게요",
  situation: "해당하는 거 모두 골라주세요",
  interest: "여러 개 선택해도 좋아요",
  result: "",
};

export function OnboardingFlow({
  policies,
  onComplete,
  onPickPolicy,
}: {
  policies: Policy[];
  onComplete: (profile: Profile) => void;
  onPickPolicy: (p: Policy) => void;
}) {
  const [step, setStep] = useState<Step>("age");
  const [age, setAge] = useState<number | undefined>(undefined);
  const [gender, setGender] = useState<Gender | undefined>(undefined);
  const [region, setRegion] = useState<string>("전국");
  const [situations, setSituations] = useState<string[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [results, setResults] = useState<(Policy & { __score: number })[]>([]);
  const [aiSummary, setAiSummary] = useState<string>("");

  const stepOrder: Step[] = ["age", "gender", "region", "situation", "interest", "result"];
  const stepIndex = stepOrder.indexOf(step);
  const progress = ((stepIndex + 1) / 6) * 100;

  const back = () => {
    const i = stepOrder.indexOf(step);
    if (i > 0) setStep(stepOrder[i - 1]);
    else onComplete(buildProfile());
  };

  const buildProfile = (): Profile => {
    const sitSet = new Set(situations);
    const household: Household | undefined = sitSet.has("single")
      ? "single"
      : sitSet.has("newlywed")
        ? "newlywed"
        : sitSet.has("multi-child")
          ? "multi-child"
          : sitSet.has("single-parent")
            ? "single-parent"
            : sitSet.has("multicultural")
              ? "multicultural"
              : undefined;
    const status: Status[] = [];
    if (sitSet.has("jobseeker")) status.push("jobseeker");
    if (sitSet.has("employed")) status.push("employed");
    if (sitSet.has("preparing-startup")) status.push("preparing-startup");
    if (sitSet.has("student")) status.push("student");

    return {
      age,
      gender,
      region,
      household,
      housing: sitSet.has("homeless") ? "homeless" : undefined,
      status,
      pregnant: sitSet.has("pregnant"),
      hasDisability: sitSet.has("disability"),
      childrenAges: sitSet.has("child") ? [3] : undefined,
      incomePct: sitSet.has("lowincome") ? 60 : undefined,
    };
  };

  const finish = async () => {
    const profile = buildProfile();
    saveProfile(profile);

    // 1. 점수 매칭 즉시 (10~200ms) — blocker가 하나라도 있으면 제외, 최소 30점
    let scored = policies
      .map((p) => ({ p, m: matchPolicy(p, profile) }))
      .filter((x) => x.m.blockers.length === 0 && x.m.score >= 30);

    if (interests.length > 0) {
      const interestSet = new Set<string>(interests);
      scored = scored.map((x) => ({
        ...x,
        m: {
          ...x.m,
          score: x.m.score + (interestSet.has(x.p.category) ? 30 : 0),
        },
      }));
    }

    scored.sort((a, b) => b.m.score - a.m.score);
    const top = scored.slice(0, 20).map((x) => ({ ...x.p, __score: x.m.score }));
    setResults(top);

    // 2. 결과 화면으로 바로 전환 (AI 안 기다림)
    setStep("result");
    onComplete(profile);

    // 3. 백그라운드에서 AI 호출 — 도착하면 상단에 보강
    setAiSummary("AI가 더 정밀한 추천을 추가하고 있어요…");
    try {
      const text = describeProfile(profile, situations, interests);
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiSummary(data.summary ?? "");
        if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
          const aiIds = new Set(data.recommendations.map((r: Policy) => r.id));
          const aiPicks = data.recommendations.map((r: Policy, i: number) => ({
            ...r,
            __score: 100 - i,
          }));
          const rest = top.filter((p) => !aiIds.has(p.id));
          setResults([...aiPicks, ...rest].slice(0, 25));
        }
      } else {
        setAiSummary("");
      }
    } catch {
      setAiSummary("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg overflow-y-auto">
      {/* 상단 헤더 (뒤로 + 진척률 + 닫기) */}
      <div className="sticky top-0 bg-bg z-10 border-b border-line">
        <div className="h-0.5 bg-bg-subtle">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="px-5 h-14 flex items-center justify-between">
          <button
            onClick={back}
            aria-label="뒤로"
            className="text-ink hover:text-ink-secondary -ml-2 px-2 py-1"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="text-13 font-semibold text-ink-tertiary">
            {stepIndex + 1} / 6
          </div>
          <button
            onClick={() => {
              if (window.confirm("나가시겠어요? 입력하신 정보는 저장되지 않습니다.")) {
                onComplete(buildProfile());
              }
            }}
            className="text-13 text-ink-secondary hover:text-ink"
          >
            건너뛰기
          </button>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-5 py-8 pb-32">
        {step !== "result" && (
          <div className="mb-8 animate-fade-in">
            <h1 className="text-26 sm:text-32 font-bold text-ink leading-tight">
              {STEP_TITLES[step]}
            </h1>
            {STEP_HINTS[step] && (
              <p className="mt-2 text-15 text-ink-secondary">{STEP_HINTS[step]}</p>
            )}
          </div>
        )}

        {step === "age" && (
          <div className="space-y-3 animate-fade-in">
            <ChipGrid
              cols={2}
              options={AGE_BUCKETS.map((b) => ({
                label: b.label,
                onClick: () => {
                  setAge(Math.floor((b.min + b.max) / 2));
                  setStep("gender");
                },
              }))}
            />
            <div className="pt-3">
              <div className="text-13 font-semibold text-ink-tertiary mb-2">또는</div>
              <InputRow
                placeholder="만 나이 직접 입력"
                type="number"
                onSubmit={(v) => {
                  if (v) {
                    setAge(Number(v));
                    setStep("gender");
                  }
                }}
              />
            </div>
          </div>
        )}

        {step === "gender" && (
          <div className="space-y-3 animate-fade-in">
            <ChipGrid
              cols={1}
              options={[
                { label: "여성", onClick: () => { setGender("female"); setStep("region"); } },
                { label: "남성", onClick: () => { setGender("male"); setStep("region"); } },
                { label: "선택하지 않음", onClick: () => { setGender("na"); setStep("region"); } },
              ]}
            />
          </div>
        )}

        {step === "region" && (
          <div className="space-y-3 animate-fade-in">
            <ChipGrid
              cols={3}
              options={REGIONS.filter((r) => r !== "전국").map((r) => ({
                key: r,
                label: r.replace(/특별시|광역시|특별자치시|특별자치도/, "").replace(/도$/, "") || r,
                onClick: () => { setRegion(r); setStep("situation"); },
              }))}
            />
            <button
              onClick={() => { setRegion("전국"); setStep("situation"); }}
              className="w-full py-3 rounded-xl text-15 text-ink-secondary hover:bg-bg-subtle transition"
            >
              선택하지 않음
            </button>
          </div>
        )}

        {step === "situation" && (
          <div className="space-y-3 animate-fade-in">
            <ChipGrid
              cols={2}
              multi
              selected={situations}
              options={SITUATIONS.map((s) => ({
                key: s.key,
                label: s.label,
                onClick: () =>
                  setSituations((prev) =>
                    prev.includes(s.key) ? prev.filter((x) => x !== s.key) : [...prev, s.key],
                  ),
              }))}
            />
            <FixedBottom>
              <NextButton
                label={situations.length === 0 ? "해당 없어요, 다음" : `다음 (${situations.length}개 선택)`}
                onClick={() => setStep("interest")}
              />
            </FixedBottom>
          </div>
        )}

        {step === "interest" && (
          <div className="space-y-3 animate-fade-in">
            <ChipGrid
              cols={2}
              multi
              selected={interests}
              options={INTERESTS.map((i) => ({
                key: i.key,
                label: i.label,
                onClick: () =>
                  setInterests((prev) =>
                    prev.includes(i.key)
                      ? prev.filter((x) => x !== i.key)
                      : [...prev, i.key as Interest],
                  ),
              }))}
            />
            <FixedBottom>
              <NextButton
                label="내 혜택 보기"
                onClick={finish}
              />
            </FixedBottom>
          </div>
        )}

        {step === "result" && (
          <ResultView
            count={results.length}
            results={results}
            aiSummary={aiSummary}
            onPick={onPickPolicy}
            onRestart={() => setStep("age")}
          />
        )}
      </div>
    </div>
  );
}

function describeProfile(p: Profile, sits: string[], ints: string[]): string {
  const parts: string[] = [];
  if (p.age) parts.push(`만 ${p.age}세`);
  if (p.gender === "female") parts.push("여성");
  if (p.gender === "male") parts.push("남성");
  if (p.region && p.region !== "전국") parts.push(p.region);
  if (sits.length > 0) {
    const sitLabels = sits
      .map((s) => SITUATIONS.find((x) => x.key === s)?.label)
      .filter(Boolean)
      .join(", ");
    parts.push(`상황: ${sitLabels}`);
  }
  if (ints.length > 0) {
    const intLabels = ints
      .map((i) => INTERESTS.find((x) => x.key === i)?.label)
      .filter(Boolean)
      .join(", ");
    parts.push(`관심: ${intLabels}`);
  }
  return parts.join(" / ") + " — 받을 수 있는 정부 혜택을 추천해주세요.";
}

function ChipGrid({
  options,
  cols = 2,
  multi = false,
  selected = [],
}: {
  options: Array<{ key?: string; label: string; onClick: () => void }>;
  cols?: number;
  multi?: boolean;
  selected?: string[];
}) {
  return (
    <div
      className={`grid gap-2 ${
        cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-2" : "grid-cols-3"
      }`}
    >
      {options.map((o, i) => {
        const k = o.key ?? o.label;
        const active = multi && selected.includes(k);
        return (
          <button
            key={i}
            onClick={o.onClick}
            className={`min-h-[56px] px-4 py-3 rounded-xl text-15 font-semibold transition border ${
              active
                ? "bg-accent border-accent text-accent-ink"
                : "bg-bg border-line text-ink hover:bg-bg-subtle hover:border-line-strong"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function InputRow({
  placeholder,
  type = "text",
  onSubmit,
}: {
  placeholder: string;
  type?: string;
  onSubmit: (v: string) => void;
}) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-2">
      <input
        type={type}
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        className="ph-input flex-1"
      />
      <button
        onClick={() => onSubmit(v)}
        disabled={!v}
        className="px-5 rounded-xl bg-accent text-accent-ink text-15 font-semibold disabled:bg-line disabled:text-ink-tertiary"
      >
        다음
      </button>
    </div>
  );
}

function FixedBottom({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-bg border-t border-line px-5 py-4 z-20">
      <div className="max-w-xl mx-auto">{children}</div>
    </div>
  );
}

function NextButton({
  disabled,
  label,
  onClick,
}: {
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-4 rounded-xl bg-accent text-accent-ink text-15 font-bold hover:bg-accent-dark disabled:bg-line disabled:text-ink-tertiary transition"
    >
      {label}
    </button>
  );
}

function ResultView({
  count,
  results,
  aiSummary,
  onPick,
  onRestart,
}: {
  count: number;
  results: (Policy & { __score: number })[];
  aiSummary: string;
  onPick: (p: Policy) => void;
  onRestart: () => void;
}) {
  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-subtle text-13 font-semibold text-accent-dark mb-3">
          분석 완료
        </div>
        <h1 className="text-26 sm:text-32 font-bold text-ink leading-tight">
          {count}개의 혜택을<br />받으실 수 있어요
        </h1>
        {aiSummary && (
          <p className="mt-3 text-15 text-ink-secondary leading-relaxed">{aiSummary}</p>
        )}
      </div>

      <div className="space-y-3">
        {results.map((p) => (
          <PolicyCard key={p.id} policy={p} onClick={() => onPick(p)} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2">
        <button
          onClick={onRestart}
          className="py-4 rounded-xl bg-bg-subtle hover:bg-line text-ink text-15 font-semibold transition"
        >
          다시 찾기
        </button>
        <button
          onClick={() => window.location.reload()}
          className="py-4 rounded-xl bg-accent hover:bg-accent-dark text-accent-ink text-15 font-semibold transition"
        >
          전체 보기
        </button>
      </div>
    </div>
  );
}
