"use client";

import { useEffect, useState } from "react";

type NewsItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  updatedAt: string;
  agency: string;
  category: string;
};

export function PolicyNewsSection() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.json())
      .then((d) => setNews(d.items ?? []))
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading || error || news.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-19 sm:text-22 font-bold text-ink">최근 정책 소식</h2>
          <p className="text-13 text-ink-tertiary mt-1">
            한시·긴급 사업 발표를 가장 먼저 확인하세요
          </p>
        </div>
        <a
          href="https://www.korea.kr/main.do"
          target="_blank"
          rel="noreferrer noopener"
          className="text-13 text-accent hover:text-accent-dark font-semibold shrink-0"
        >
          전체 보기
        </a>
      </div>

      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {news.map((n) => (
          <a
            key={n.id}
            href={n.url}
            target="_blank"
            rel="noreferrer noopener"
            className="shrink-0 w-72 bg-bg border border-line hover:border-ink/30 rounded-xl p-4 transition"
          >
            <div className="text-11 font-medium text-ink-tertiary mb-1.5">
              {n.updatedAt}
            </div>
            <h3 className="text-15 font-bold text-ink leading-snug line-clamp-2 mb-1.5">
              {n.title}
            </h3>
            <p className="text-13 text-ink-secondary line-clamp-3">{n.summary}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
