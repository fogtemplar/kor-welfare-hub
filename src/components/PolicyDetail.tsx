"use client";

import type { Policy } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { useEffect } from "react";

export function PolicyDetail({
  policy,
  onClose,
}: {
  policy: Policy;
  onClose: () => void;
}) {
  const meta = CATEGORIES.find((c) => c.key === policy.category)!;
  const levelLabel =
    policy.level === "national" ? "전국" : policy.level === "metro" ? "광역" : "기초";

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-bg rounded-t-2xl sm:rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-bg/95 backdrop-blur px-5 py-4 border-b border-line flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-11 font-semibold px-2 py-0.5 rounded ${meta.color}`}>
              {meta.emoji} {meta.label}
            </span>
            <span className="text-11 font-medium text-ink-tertiary">
              {levelLabel}
              {policy.region && policy.region !== "전국" ? ` · ${policy.region}` : ""}
            </span>
            {policy.isAlwaysOpen && (
              <span className="text-11 font-semibold text-success">상시신청</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-ink-tertiary hover:text-ink text-19 leading-none shrink-0"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-6 space-y-6">
          <div>
            <div className="text-13 text-ink-tertiary mb-1.5">{policy.agency}</div>
            <h2 className="text-22 sm:text-26 font-bold text-ink leading-tight">{policy.title}</h2>
            <p className="mt-3 text-15 text-ink-secondary leading-relaxed">{policy.summary}</p>
          </div>

          <DetailRow label="혜택 내용" value={policy.benefit} accent />
          <DetailRow label="지원 대상" value={policy.eligibility} />
          <DetailRow label="신청 방법" value={policy.howTo} />

          {policy.tags && policy.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {policy.tags.map((t) => (
                <span
                  key={t}
                  className="text-11 px-2 py-1 rounded bg-bg-subtle text-ink-secondary"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          <div className="text-11 text-ink-tertiary pt-3 border-t border-line">
            최종 업데이트 {policy.updatedAt} · 출처 {policy.source}
          </div>
        </div>

        <div className="px-5 pb-5 sticky bottom-0 bg-gradient-to-t from-bg via-bg to-transparent pt-4">
          <a
            href={policy.url}
            target="_blank"
            rel="noreferrer noopener"
            className="block text-center w-full py-4 rounded-xl bg-accent hover:bg-accent-dark text-accent-ink text-15 font-bold transition"
          >
            공식 페이지에서 신청
          </a>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-13 font-semibold text-ink-tertiary mb-2">{label}</div>
      <div
        className={`whitespace-pre-line text-15 leading-relaxed rounded-xl px-4 py-3 ${
          accent
            ? "bg-accent-subtle text-ink"
            : "bg-bg-subtle text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
