"use client";

import { useEffect, useMemo, useState } from "react";
import type { Policy, PolicyCategory } from "@/lib/types";
import { CATEGORIES, REGIONS } from "@/lib/types";
import { applyFilter, DEFAULT_FILTER, type FilterState } from "@/lib/filter";
import {
  clearProfile,
  EMPTY_PROFILE,
  isProfileSet,
  loadProfile,
  matchPolicy,
  type MatchResult,
  type Profile,
  saveProfile,
} from "@/lib/profile";
import { PolicyCard } from "./PolicyCard";
import { PolicyDetail } from "./PolicyDetail";
import { ProfileSheet } from "./ProfileSheet";
import { PolicyNewsSection } from "./PolicyNewsSection";
import { OnboardingFlow } from "./OnboardingFlow";
import { BottomNav } from "./BottomNav";
import { InlineAiSearch } from "./InlineAiSearch";
import { getBookmarks } from "@/lib/bookmarks";

const ONBOARDING_KEY = "kor-welfare-hub:onboarded:v1";

type ScoredPolicy = Policy & {
  __match?: MatchResult;
};

export function Dashboard({ policies }: { policies: Policy[] }) {
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [selected, setSelected] = useState<Policy | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [profileOpen, setProfileOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<"home" | "saved">("home");
  const [bookmarkIds, setBookmarkIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const refresh = () => setBookmarkIds(getBookmarks());
    refresh();
    window.addEventListener("bookmarks:change", refresh);
    return () => window.removeEventListener("bookmarks:change", refresh);
  }, []);

  useEffect(() => {
    const stored = loadProfile();
    if (stored) setProfile({ ...EMPTY_PROFILE, ...stored });
    setHydrated(true);
    // 첫 방문자에게 자동 온보딩
    if (typeof window !== "undefined") {
      const done = window.localStorage.getItem(ONBOARDING_KEY);
      if (!done && !stored) setOnboardingOpen(true);
    }
  }, []);

  const finishOnboarding = (p: Profile) => {
    setProfile(p);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_KEY, "1");
    }
    setOnboardingOpen(false);
  };

  const hasProfile = hydrated && isProfileSet(profile);

  useEffect(() => {
    if (!hasProfile) return;
    if (filter.region === "전국" && profile.region && profile.region !== "전국") {
      setFilter((f) => ({ ...f, region: profile.region! }));
    }
  }, [hasProfile, profile.region]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredAll = useMemo(() => applyFilter(policies, filter), [policies, filter]);
  const results = useMemo(
    () => (tab === "saved" ? filteredAll.filter((p) => bookmarkIds.has(p.id)) : filteredAll),
    [filteredAll, tab, bookmarkIds],
  );
  const [visibleCount, setVisibleCount] = useState(60);
  useEffect(() => {
    setVisibleCount(60);
  }, [filter]);
  const recommended = useMemo<ScoredPolicy[]>(() => {
    if (!hasProfile) return [];
    return policies
      .map((p) => ({ ...p, __match: matchPolicy(p, profile) }))
      .filter((p) => (p.__match?.blockers.length ?? 0) === 0 && (p.__match?.score ?? 0) >= 40)
      .sort((a, b) => (b.__match?.score ?? 0) - (a.__match?.score ?? 0))
      .slice(0, 9);
  }, [policies, profile, hasProfile]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: policies.length };
    for (const c of CATEGORIES) counts[c.key] = 0;
    for (const p of policies) counts[p.category] = (counts[p.category] ?? 0) + 1;
    return counts;
  }, [policies]);

  const setCategory = (key: PolicyCategory | "all") =>
    setFilter((f) => ({ ...f, category: key }));

  const handleSaveProfile = (p: Profile) => {
    setProfile(p);
    saveProfile(p);
    setProfileOpen(false);
  };

  const handleResetProfile = () => {
    setProfile(EMPTY_PROFILE);
    clearProfile();
  };

  return (
    <div className="min-h-screen bg-bg pb-20">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
        <header className="mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-subtle text-13 font-semibold text-accent-dark mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            정부 혜택 {policies.length.toLocaleString()}개 통합
          </div>
          <h1 className="text-26 sm:text-32 font-bold text-ink leading-tight tracking-tight">
            받을 수 있는 정부 혜택,<br className="sm:hidden" /> 다 모아봤어요
          </h1>
          <p className="mt-3 text-15 sm:text-17 text-ink-secondary max-w-xl leading-relaxed">
            복지로·정부24·청년정책·K-Startup 데이터를 한 곳에서 찾고,
            내 상황에 맞는 혜택을 30초 만에 알려드려요.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => setOnboardingOpen(true)}
              className="px-5 py-3 rounded-xl bg-accent text-accent-ink text-15 font-bold hover:bg-accent-dark transition"
            >
              내 혜택 찾아보기
            </button>
            <button
              onClick={() => setProfileOpen(true)}
              className={`px-5 py-3 rounded-xl text-15 font-bold transition ${
                hasProfile
                  ? "bg-accent-subtle text-accent-dark hover:bg-accent-light"
                  : "bg-bg-subtle text-ink hover:bg-line"
              }`}
            >
              {hasProfile ? "내 프로필" : "내 정보 입력"}
            </button>
          </div>
        </header>

        <InlineAiSearch onPickPolicy={(p) => setSelected(p)} />

        {/* Recommended */}
        {hasProfile && recommended.length > 0 && (
          <section className="mb-10">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <h2 className="text-19 sm:text-22 font-bold text-ink">
                  내게 딱 맞는 혜택 {recommended.length}건
                </h2>
                <p className="text-13 text-ink-tertiary mt-1">
                  {summarizeProfile(profile)} 기준이에요
                </p>
              </div>
              <button
                onClick={() => setProfileOpen(true)}
                className="text-13 text-accent font-semibold hover:text-accent-dark"
              >
                정보 수정
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recommended.map((p) => (
                <ScoredCard key={p.id} policy={p} onClick={() => setSelected(p)} />
              ))}
            </div>
          </section>
        )}

        {hasProfile && recommended.length === 0 && (
          <section className="mb-10 rounded-xl bg-bg-subtle p-5">
            <div className="text-15 font-semibold text-ink mb-1">
              아직 딱 맞는 혜택을 못 찾았어요
            </div>
            <p className="text-13 text-ink-secondary">
              정보를 조금 더 채워보거나, 아래 카테고리에서 둘러보세요.
            </p>
          </section>
        )}

        <PolicyNewsSection />

        {/* Search & Filter Bar */}
        <div className="sticky top-0 z-20 -mx-5 px-5 py-3 mb-5 bg-bg/95 backdrop-blur border-b border-line">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-6">
              <input
                value={filter.q}
                onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
                placeholder="정책명·기관·혜택 검색 (예: 월세, 청년, 출산)"
                className="w-full bg-bg-subtle border border-line focus:border-accent focus:bg-bg rounded-xl px-4 py-3 text-15 outline-none transition"
              />
            </div>
            <select
              value={filter.region}
              onChange={(e) => setFilter((f) => ({ ...f, region: e.target.value }))}
              className="sm:col-span-3 bg-bg-subtle border border-line rounded-xl px-3 py-3 text-15 text-ink outline-none focus:border-accent"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              value={filter.level}
              onChange={(e) =>
                setFilter((f) => ({ ...f, level: e.target.value as FilterState["level"] }))
              }
              className="sm:col-span-3 bg-bg-subtle border border-line rounded-xl px-3 py-3 text-15 text-ink outline-none focus:border-accent"
            >
              <option value="all">정부 + 지자체</option>
              <option value="national">중앙정부</option>
              <option value="metro">광역지자체</option>
              <option value="local">기초지자체</option>
            </select>
          </div>
        </div>

        {/* Category Chips */}
        <div className="flex flex-wrap gap-2 mb-8 -mx-1 px-1 overflow-x-auto no-scrollbar">
          <CategoryChip
            label={`전체 ${categoryCounts.all.toLocaleString()}`}
            active={filter.category === "all"}
            onClick={() => setCategory("all")}
          />
          {CATEGORIES.map((c) => (
            <CategoryChip
              key={c.key}
              label={`${c.label} ${categoryCounts[c.key] || 0}`}
              active={filter.category === c.key}
              onClick={() => setCategory(c.key)}
            />
          ))}
        </div>

        {/* Results */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-13 text-ink-secondary">
            <span className="text-ink font-semibold">{results.length.toLocaleString()}</span>건
            {filter.q && <span className="text-ink-tertiary"> · &ldquo;{filter.q}&rdquo; 결과</span>}
          </div>
          <select
            value={filter.sort}
            onChange={(e) =>
              setFilter((f) => ({ ...f, sort: e.target.value as FilterState["sort"] }))
            }
            className="bg-bg-subtle border border-line rounded-lg px-3 py-1.5 text-13 text-ink-secondary outline-none focus:border-accent"
          >
            <option value="recent">최근 업데이트 순</option>
            <option value="alpha">가나다 순</option>
          </select>
        </div>

        {results.length === 0 ? (
          <div className="rounded-2xl bg-bg-subtle p-12 text-center">
            {tab === "saved" ? (
              <>
                <div className="text-15 font-semibold text-ink mb-1">저장한 혜택이 없어요</div>
                <p className="text-13 text-ink-secondary">관심 있는 혜택의 저장 버튼을 눌러보세요</p>
              </>
            ) : (
              <>
                <div className="text-15 font-semibold text-ink mb-1">검색 결과가 없어요</div>
                <p className="text-13 text-ink-secondary">검색어나 지역을 바꿔보세요</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {results.slice(0, visibleCount).map((p) => (
                <PolicyCard key={p.id} policy={p} onClick={() => setSelected(p)} />
              ))}
            </div>
            {results.length > visibleCount && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setVisibleCount((n) => n + 60)}
                  className="px-6 py-3 rounded-xl bg-bg-subtle hover:bg-line text-15 font-semibold text-ink transition"
                >
                  더 보기 ({(results.length - visibleCount).toLocaleString()}건 남음)
                </button>
              </div>
            )}
          </>
        )}

        <footer className="mt-20 pb-12 pt-8 border-t border-line text-13 text-ink-tertiary space-y-2">
          <p>
            본 사이트는 정부·지자체 공개 정책 정보를 모은 비공식 안내 서비스입니다. 신청 전 반드시
            공식 페이지에서 최신 조건을 확인하세요.
          </p>
          <p>
            데이터 출처: 한국사회보장정보원(복지로) · 행정안전부(정부24) · 국무조정실(온통청년) ·
            창업진흥원(K-Startup) · 정책브리핑(korea.kr)
          </p>
        </footer>

      {selected && <PolicyDetail policy={selected} onClose={() => setSelected(null)} />}
      <ProfileSheet
        open={profileOpen}
        initial={profile}
        onSave={handleSaveProfile}
        onClear={handleResetProfile}
        onClose={() => setProfileOpen(false)}
      />
      {onboardingOpen && (
        <OnboardingFlow
          policies={policies}
          onComplete={finishOnboarding}
          onPickPolicy={(p) => {
            finishOnboarding(profile);
            setSelected(p);
          }}
        />
      )}
      </div>
      <BottomNav
        active={tab}
        onChange={setTab}
        onRestart={() => {
          setTab("home");
          setOnboardingOpen(true);
        }}
      />
    </div>
  );
}

function ScoredCard({
  policy,
  onClick,
}: {
  policy: ScoredPolicy;
  onClick: () => void;
}) {
  return <PolicyCard policy={policy} onClick={onClick} />;
}

function summarizeProfile(p: Profile): string {
  const parts: string[] = [];
  if (typeof p.age === "number") parts.push(`만 ${p.age}세`);
  if (p.gender === "female") parts.push("여성");
  else if (p.gender === "male") parts.push("남성");
  if (p.region && p.region !== "전국") parts.push(p.region);
  if (p.household) {
    const m: Record<string, string> = {
      single: "1인가구",
      couple: "부부",
      newlywed: "신혼",
      general: "일반가구",
      "multi-child": "다자녀",
      "single-parent": "한부모",
      multicultural: "다문화",
    };
    if (m[p.household]) parts.push(m[p.household]);
  }
  if ((p.childrenAges ?? []).length > 0) parts.push(`자녀 ${p.childrenAges!.length}명`);
  return parts.length ? parts.join(" · ") : "입력하신";
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-2 rounded-lg text-13 font-semibold transition ${
        active
          ? "bg-ink text-white"
          : "bg-bg-subtle text-ink-secondary hover:bg-line"
      }`}
    >
      {label}
    </button>
  );
}
