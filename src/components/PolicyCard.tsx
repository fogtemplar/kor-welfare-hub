"use client";

import { useEffect, useState } from "react";
import type { Policy } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { getCardMeta } from "@/lib/cardMeta";
import { isBookmarked, toggleBookmark } from "@/lib/bookmarks";

export function PolicyCard({
  policy,
  onClick,
}: {
  policy: Policy;
  onClick: () => void;
}) {
  const meta = CATEGORIES.find((c) => c.key === policy.category)!;
  const cardMeta = getCardMeta(policy);
  const levelLabel =
    policy.level === "national" ? "전국" : policy.level === "metro" ? "광역" : "기초";

  const [bookmarked, setBookmarked] = useState(false);
  useEffect(() => {
    setBookmarked(isBookmarked(policy.id));
    const h = () => setBookmarked(isBookmarked(policy.id));
    window.addEventListener("bookmarks:change", h);
    return () => window.removeEventListener("bookmarks:change", h);
  }, [policy.id]);

  const onBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarked(toggleBookmark(policy.id));
  };

  return (
    <div className="bg-bg-subtle rounded-2xl p-4 flex flex-col h-full min-h-[260px]">
      {/* 1. 배지 영역 (고정 높이) */}
      <div className="flex items-center gap-1.5 flex-wrap min-h-[20px]">
        <span className={`text-11 font-semibold px-2 py-0.5 rounded-md ${meta.color}`}>
          {meta.emoji} {meta.label}
        </span>
        <span className="text-11 font-medium text-ink-tertiary">
          {levelLabel}
          {policy.region && policy.region !== "전국" ? ` · ${policy.region}` : ""}
        </span>
        {cardMeta.isHot && (
          <span className="text-11 font-bold px-1.5 py-0.5 rounded bg-hot text-white">HOT</span>
        )}
      </div>

      {/* 2. 콘텐츠 (제목·금액·요약) — flex-1로 빈 공간 차지 */}
      <button
        onClick={onClick}
        className="text-left flex flex-col gap-1.5 mt-2.5 flex-1"
      >
        <h3 className="text-15 font-bold text-ink leading-snug line-clamp-2 min-h-[44px]">
          {policy.title}
        </h3>
        {cardMeta.amount && (
          <div className="text-17 font-extrabold text-ink">{cardMeta.amount}</div>
        )}
        <p className="text-13 text-ink-secondary line-clamp-2">{policy.summary}</p>
      </button>

      {/* 3. 메타 + 버튼 (항상 하단) */}
      <div className="mt-3 flex items-center gap-3 text-11 text-ink-tertiary">
        <span>
          난이도 <strong className="text-ink-secondary">{cardMeta.difficulty}</strong>
        </span>
        <span>·</span>
        <span>
          신청 <strong className="text-ink-secondary">{cardMeta.applyTime}</strong>
        </span>
      </div>

      <div className="flex gap-2 mt-2.5">
        <button
          onClick={onClick}
          className="flex-1 py-2.5 rounded-lg bg-accent hover:bg-accent-dark text-accent-ink text-13 font-bold transition"
        >
          바로 신청하기
        </button>
        <button
          onClick={onBookmark}
          aria-label={bookmarked ? "저장 해제" : "저장"}
          className={`px-3 py-2.5 rounded-lg border text-13 font-semibold transition ${
            bookmarked
              ? "bg-ink text-bg-subtle border-ink"
              : "bg-bg-subtle text-ink border-line hover:border-ink"
          }`}
        >
          {bookmarked ? "✓ 저장됨" : "저장"}
        </button>
      </div>
    </div>
  );
}
