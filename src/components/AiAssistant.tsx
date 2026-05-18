"use client";

import { useEffect, useState } from "react";
import type { Policy } from "@/lib/types";
import type { Profile } from "@/lib/profile";
import { saveProfile } from "@/lib/profile";

type AIResponse = {
  profile: Partial<Profile>;
  summary: string;
  followUp?: string;
  recommendations: (Policy & { aiReason: string })[];
};

const EXAMPLES = [
  "28살, 서울 1인가구, 최근 퇴사·월세",
  "30대 부부, 임신 중, 경기도 거주",
  "65세 어머니 혼자 사세요. 기초연금 외 다른 도움?",
  "대학교 4학년, 졸업 후 창업 준비",
];

export function AiAssistant({
  open,
  onClose,
  onPickPolicy,
}: {
  open: boolean;
  onClose: () => void;
  onPickPolicy: (p: Policy) => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      if (!res.ok) {
        setError(data.error || "AI 응답 오류");
      } else {
        setResult(data);
      }
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
    <div
      className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-bg rounded-t-2xl sm:rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur px-5 py-4 border-b border-line flex items-start justify-between gap-4">
          <div>
            <h2 className="text-17 font-bold text-ink">상황 입력</h2>
            <p className="text-13 text-ink-tertiary mt-0.5">
              본인 상황을 적어주세요. AI가 맞는 혜택을 골라드려요.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-ink-tertiary hover:text-ink text-19 leading-none shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {!result && (
            <>
              <div className="relative">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="예: 30살이고 서울 혼자 살며 월세 사는데 최근 직장을 그만뒀어요."
                  rows={5}
                  maxLength={1000}
                  className="w-full bg-bg-subtle border border-line focus:border-accent focus:bg-bg rounded-xl px-4 py-3 text-15 outline-none transition resize-none"
                />
                <div className="absolute bottom-3 right-3 text-11 text-ink-tertiary">
                  {text.length}/1000
                </div>
              </div>

              <div>
                <div className="text-13 font-semibold text-ink-tertiary mb-2">예시</div>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => setText(ex)}
                      className="text-13 px-3 py-2 rounded-lg bg-bg-subtle hover:bg-line text-ink-secondary font-medium"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-bg-subtle px-3 py-2 text-13 text-ink-secondary leading-relaxed">
                입력한 텍스트는 분석을 위해 Google Gemini로 전송됩니다. 주민번호·전화번호·이름 등은
                입력하지 마세요.
              </div>

              {error && (
                <div className="rounded-lg bg-danger/10 text-danger px-3 py-2 text-13">
                  {error}
                </div>
              )}

              <button
                onClick={submit}
                disabled={loading || text.trim().length < 5}
                className="w-full py-4 rounded-xl bg-accent hover:bg-accent-dark disabled:bg-line disabled:text-ink-tertiary text-accent-ink text-15 font-bold transition"
              >
                {loading ? "분석 중…" : "AI 분석 시작"}
              </button>
            </>
          )}

          {result && (
            <>
              <div className="rounded-xl bg-accent-subtle px-4 py-3">
                <div className="text-11 font-semibold text-accent-dark mb-1">AI 분석 결과</div>
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
                <div className="text-15 font-bold text-ink mb-3">
                  추천 혜택 {result.recommendations.length}건
                </div>
                <div className="space-y-2">
                  {result.recommendations.map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => onPickPolicy(p)}
                      className="w-full text-left bg-bg border border-line hover:border-ink/30 rounded-xl px-4 py-3 transition"
                    >
                      <div className="flex items-start gap-3">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-accent-subtle text-accent-dark text-11 font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-15 font-bold text-ink">{p.title}</div>
                          <div className="text-11 text-ink-tertiary mt-0.5">{p.agency}</div>
                          <div className="text-13 text-success mt-1.5">{p.aiReason}</div>
                          <div className="text-13 text-ink-secondary mt-1">{p.benefit}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {result.followUp && (
                <div className="rounded-xl bg-bg-subtle px-4 py-3">
                  <div className="text-11 font-semibold text-ink-tertiary mb-1">추가 질문</div>
                  <div className="text-13 text-ink">{result.followUp}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={reset}
                  className="py-3 rounded-xl bg-bg-subtle hover:bg-line text-ink text-15 font-semibold"
                >
                  다시 물어보기
                </button>
                <button
                  onClick={onClose}
                  className="py-3 rounded-xl bg-accent hover:bg-accent-dark text-accent-ink text-15 font-semibold"
                >
                  닫기
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
