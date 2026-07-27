import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 약관·처리방침 공통 레이아웃.
 * 토스 로그인 신청서에 URL을 제출해야 하므로 실제 라우트로 존재해야 한다.
 */
export function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
        <Link
          href="/"
          className="text-13 text-accent font-semibold hover:text-accent-dark"
        >
          ← 홈으로
        </Link>

        <h1 className="mt-6 text-26 sm:text-32 font-bold text-ink tracking-tight">
          {title}
        </h1>
        <p className="mt-2 text-13 text-ink-tertiary">시행일 {effectiveDate}</p>

        <div className="mt-10 space-y-8 text-15 text-ink-secondary leading-relaxed">
          {children}
        </div>

        <footer className="mt-16 pt-8 border-t border-line text-13 text-ink-tertiary">
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-ink">이용약관</Link>
            <Link href="/privacy" className="hover:text-ink">개인정보 처리방침</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-17 sm:text-19 font-bold text-ink mb-3">{heading}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-bg-subtle p-4 text-14 text-ink-secondary leading-relaxed">
      {children}
    </div>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5 pl-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-ink-tertiary shrink-0">·</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
