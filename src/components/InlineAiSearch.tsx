"use client";

import { useState } from "react";
import type { Policy } from "@/lib/types";
import type { Profile } from "@/lib/profile";
import { saveProfile } from "@/lib/profile";
import { PolicyCard } from "./PolicyCard";

type AIResponse = {
  profile: Partial<Profile>;
  summary: string;
  followUp?: string;
  recommendations: (Policy & { aiReason: string })[];
};

const EXAMPLES = [
  "28살 서울 1인가구, 최근 퇴사하고 월세 살아요",
  "30대 부부, 임신 중, 경기도 거주",
  "65세 어머니 혼자 사세요. 기초연금 외 다른 도움?",
  "대학교 4학년, 졸업 후 창업 준비 중",
];

export function InlineAiSearch({
  onPickPolicy,
}: {
  onPickPolicy: (p: Policy) => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (text.trim().length < 5) {
      setError("최소 5자 이상 입력해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "AI 응답 오류");
      else setResult(data);
    } catch (e: any) {
      setError("네트워크 오류: " + (e?.message || "unknown"));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setText("");
    setResult(null);
    setError(null);
  };

  const saveProfileToLocal = () => {
    if (!result?.profile) return;
    const clean: Profile = {
      region: "전국",
      ...result.profile,
      status: result.profile.status ?? [],
    };
    saveProfile(clean);
    window.location.reload();
  };

  return (
    <section className="mb-10">
      {/* 상단 큰 검색 박스 */}
      <div className="bg-bg-subtle rounded-2xl p-5 sm:p-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-17 sm:text-19 font-bold text-ink">
            상황으로 검색
          </h2>
          <span className="text-11 text-ink-tertiary hidden sm:inline">
            AI가 상황에 맞는 혜택을 골라드려요
          </span>
        </div>

        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="예: 30살 서울 1인가구, 최근 퇴사·월세 거주"
            rows={3}
            maxLength={1000}
            className="w-full bg-bg border border-line focus:border-accent rounded-xl px-4 py-3 text-15 outline-none transition resize-none placeholder:text-ink-tertiary"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
          />
          <div className="absolute bottom-3 right-3 text-11 text-ink-tertiary">
            {text.length}/1000
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => setText(ex)}
              className="text-13 px-3 py-1.5 rounded-lg bg-bg hover:bg-line text-ink-secondary font-medium transition border border-line"
            >
              {ex}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-danger/10 text-danger px-3 py-2 text-13">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <button
            onClick={submit}
            disabled={loading || text.trim().length < 5}
            className="flex-1 py-3 rounded-xl bg-accent hover:bg-accent-dark disabled:bg-line disabled:text-ink-tertiary text-accent-ink text-15 font-bold transition"
          >
            {loading ? "분석 중…" : "AI 분석 시작"}
          </button>
          {result && (
            <button
              onClick={reset}
              className="px-5 py-3 rounded-xl bg-bg hover:bg-line border border-line text-ink text-15 font-semibold transition"
            >
              초기화
            </button>
          )}
        </div>

        <p className="mt-3 text-11 text-ink-tertiary leading-relaxed">
          입력 텍스트는 분석을 위해 Google Gemini로 전송됩니다. 주민번호·전화번호·이름 등 식별정보는 입력하지 마세요.
        </p>
      </div>

      {/* 결과 영역 (inline) */}
      {result && (
        <div className="mt-6 space-y-5 animate-fade-in">
          <div className="rounded-xl bg-accent-subtle px-4 py-3">
            <div className="text-11 font-semibold text-accent-dark mb-1">AI 분석</div>
            <div className="text-15 text-ink leading-relaxed">{result.summary}</div>
          </div>

          {result.profile && Object.keys(result.profile).length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-13 font-semibold text-ink-tertiary">추출된 프로필</div>
                <button
                  onClick={saveProfileToLocal}
                  className="text-13 font-semibold text-accent hover:text-accent-dark"
                >
                  이 프로필로 저장
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(result.profile)
                  .filter(
                    ([, v]) =>
                      v !== null &&
                      v !== undefined &&
                      v !== "" &&
                      !(Array.isArray(v) && v.length === 0),
                  )
                  .map(([k, v]) => (
                    <span
                      key={k}
                      className="text-11 px-2 py-1 rounded bg-bg-subtle text-ink-secondary"
                    >
                      {k}: {Array.isArray(v) ? v.join(",") : String(v)}
                    </span>
                  ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-19 font-bold text-ink mb-3">
              추천 혜택 {result.recommendations.length}건
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {result.recommendations.map((p) => (
                <PolicyCard key={p.id} policy={p} onClick={() => onPickPolicy(p)} />
              ))}
            </div>
          </div>

          {result.followUp && (
            <div className="rounded-xl bg-bg-subtle px-4 py-3">
              <div className="text-11 font-semibold text-ink-tertiary mb-1">추가 질문</div>
              <div className="text-15 text-ink">{result.followUp}</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
