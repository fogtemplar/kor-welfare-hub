"use client";

import { useEffect, useState } from "react";
import { REGIONS } from "@/lib/types";
import {
  EMPTY_PROFILE,
  type Gender,
  type Household,
  type Housing,
  type Profile,
  type Status,
} from "@/lib/profile";

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "female", label: "여성" },
  { value: "male", label: "남성" },
  { value: "na", label: "선택 안함" },
];

const HOUSEHOLD_OPTIONS: { value: Household; label: string }[] = [
  { value: "single", label: "1인가구" },
  { value: "couple", label: "부부" },
  { value: "newlywed", label: "신혼 (7년 이내)" },
  { value: "general", label: "일반가구" },
  { value: "multi-child", label: "다자녀" },
  { value: "single-parent", label: "한부모" },
  { value: "multicultural", label: "다문화" },
];

const HOUSING_OPTIONS: { value: Housing; label: string }[] = [
  { value: "own", label: "자가 (보유)" },
  { value: "jeonse", label: "전세" },
  { value: "monthly", label: "월세" },
  { value: "with-family", label: "부모/가족과 거주" },
  { value: "homeless", label: "주거 불안정" },
];

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "student", label: "대학(원)생" },
  { value: "jobseeker", label: "구직 중" },
  { value: "employed", label: "재직 중" },
  { value: "self-employed", label: "자영업·프리랜서" },
  { value: "preparing-startup", label: "창업 준비/초기" },
  { value: "farmer", label: "농어업" },
  { value: "career-break", label: "경력단절 / 휴직" },
  { value: "retired", label: "은퇴" },
];

const INCOME_OPTIONS: { value: number | undefined; label: string }[] = [
  { value: undefined, label: "선택 안함" },
  { value: 50, label: "중위 50% 이하" },
  { value: 75, label: "중위 75% 이하" },
  { value: 100, label: "중위 100% 이하" },
  { value: 150, label: "중위 150% 이하" },
  { value: 250, label: "중위 250% 이하" },
  { value: 999, label: "해당 없음 / 고소득" },
];

export function ProfileSheet({
  open,
  initial,
  onClose,
  onSave,
  onClear,
}: {
  open: boolean;
  initial: Profile;
  onClose: () => void;
  onSave: (p: Profile) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState<Profile>(initial);

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const toggleStatus = (s: Status) => {
    setDraft((d) => {
      const cur = new Set(d.status ?? []);
      if (cur.has(s)) cur.delete(s);
      else cur.add(s);
      return { ...d, status: Array.from(cur) };
    });
  };

  const setChildrenCount = (count: number) => {
    setDraft((d) => {
      if (count === 0) return { ...d, childrenAges: undefined };
      const baseAge = d.childrenAges?.[0] ?? 0;
      return { ...d, childrenAges: Array(count).fill(baseAge) };
    });
  };

  const setYoungestAge = (age: number | undefined) => {
    setDraft((d) => {
      if (!d.childrenAges || d.childrenAges.length === 0) return d;
      const n = d.childrenAges.length;
      return { ...d, childrenAges: Array(n).fill(age ?? 0) };
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-bg rounded-t-2xl sm:rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur px-6 py-4 border-b border-line flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">내 프로필 설정</h2>
            <p className="text-xs text-ink-tertiary mt-0.5">
              입력한 정보는 이 브라우저에만 저장됩니다 (서버 전송 없음).
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-ink-tertiary hover:text-ink text-xl leading-none shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <Section title="기본 정보">
            <div className="grid grid-cols-2 gap-3">
              <Field label="나이">
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={draft.age ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      age: e.target.value === "" ? undefined : Number(e.target.value),
                    }))
                  }
                  placeholder="예: 28"
                  className="ph-input"
                />
              </Field>
              <Field label="성별">
                <select
                  value={draft.gender ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      gender: (e.target.value || undefined) as Gender | undefined,
                    }))
                  }
                  className="ph-input"
                >
                  <option value="" className="bg-bg">선택 안함</option>
                  {GENDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-bg">
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="거주 지역">
              <select
                value={draft.region ?? "전국"}
                onChange={(e) => setDraft((d) => ({ ...d, region: e.target.value }))}
                className="ph-input"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r} className="bg-bg">
                    {r}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          <Section title="가구 유형">
            <ChipGroup
              options={HOUSEHOLD_OPTIONS}
              value={draft.household}
              onChange={(v) =>
                setDraft((d) => ({ ...d, household: (v || undefined) as Household | undefined }))
              }
            />
          </Section>

          <Section title="주거 상황">
            <ChipGroup
              options={HOUSING_OPTIONS}
              value={draft.housing}
              onChange={(v) =>
                setDraft((d) => ({ ...d, housing: (v || undefined) as Housing | undefined }))
              }
            />
          </Section>

          <Section title="경제활동 상태 (복수 선택)">
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((o) => {
                const active = (draft.status ?? []).includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleStatus(o.value)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition ${
                      active
                        ? "bg-accent border-accent text-accent-ink"
                        : "bg-bg-subtle border-line text-ink hover:bg-line"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="자녀">
            <div className="grid grid-cols-2 gap-3">
              <Field label="자녀 수">
                <select
                  value={draft.childrenAges?.length ?? 0}
                  onChange={(e) => setChildrenCount(Number(e.target.value))}
                  className="ph-input"
                >
                  {[0, 1, 2, 3, 4].map((n) => (
                    <option key={n} value={n} className="bg-bg">
                      {n}명
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="막내 나이 (만)">
                <input
                  type="number"
                  min={0}
                  max={25}
                  value={draft.childrenAges?.[0] ?? ""}
                  onChange={(e) =>
                    setYoungestAge(e.target.value === "" ? undefined : Number(e.target.value))
                  }
                  disabled={!draft.childrenAges || draft.childrenAges.length === 0}
                  placeholder="예: 2"
                  className="ph-input disabled:opacity-40"
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm mt-3">
              <input
                type="checkbox"
                checked={!!draft.pregnant}
                onChange={(e) => setDraft((d) => ({ ...d, pregnant: e.target.checked }))}
                className="accent-accent"
              />
              <span>임신 중</span>
            </label>
          </Section>

          <Section title="소득 (가구 기준 중위소득)">
            <select
              value={draft.incomePct === undefined ? "" : String(draft.incomePct)}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  incomePct: e.target.value === "" ? undefined : Number(e.target.value),
                }))
              }
              className="ph-input"
            >
              {INCOME_OPTIONS.map((o) => (
                <option
                  key={String(o.value)}
                  value={o.value === undefined ? "" : o.value}
                  className="bg-bg"
                >
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-tertiary mt-1.5">
              정확하지 않아도 됩니다. 대략적인 구간을 골라주세요.
            </p>
          </Section>

          <Section title="추가 정보">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!draft.hasDisability}
                onChange={(e) => setDraft((d) => ({ ...d, hasDisability: e.target.checked }))}
                className="accent-accent"
              />
              <span>등록 장애인입니다</span>
            </label>
          </Section>
        </div>

        <div className="sticky bottom-0 bg-gradient-to-t from-zinc-950 via-zinc-950 to-zinc-950/80 px-6 py-4 border-t border-line flex gap-2">
          <button
            onClick={() => {
              onClear();
              setDraft(EMPTY_PROFILE);
            }}
            className="px-4 py-2.5 rounded-xl bg-bg-subtle border border-line text-ink hover:bg-line text-sm"
          >
            초기화
          </button>
          <button
            onClick={() => onSave(draft)}
            className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-accent-dark font-semibold text-accent-ink"
          >
            저장하고 맞춤 추천 보기
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-ink-tertiary mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block text-ink-secondary mb-1 text-xs">{label}</span>
      {children}
    </label>
  );
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T | "") => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(active ? "" : o.value)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${
              active
                ? "bg-accent border-accent text-accent-ink"
                : "bg-bg-subtle border-line text-ink hover:bg-line"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
