"use client";

import { useEffect, useState } from "react";
import { getBookmarks } from "@/lib/bookmarks";

type Tab = "home" | "saved";

export function BottomNav({
  active,
  onChange,
  onRestart,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  onRestart: () => void;
}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = () => setCount(getBookmarks().size);
    refresh();
    window.addEventListener("bookmarks:change", refresh);
    return () => window.removeEventListener("bookmarks:change", refresh);
  }, []);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-bg-subtle border-t border-line"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-5xl mx-auto grid grid-cols-3 h-16">
        <NavItem
          label="다시하기"
          active={false}
          onClick={onRestart}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          }
        />
        <NavItem
          label="홈"
          active={active === "home"}
          onClick={() => onChange("home")}
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          }
          highlight
        />
        <NavItem
          label={`저장${count > 0 ? ` ${count}` : ""}`}
          active={active === "saved"}
          onClick={() => onChange("saved")}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill={active === "saved" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          }
        />
      </div>
    </nav>
  );
}

function NavItem({
  label,
  icon,
  active,
  onClick,
  highlight,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 transition ${
        active ? "text-ink" : "text-ink-tertiary hover:text-ink-secondary"
      }`}
    >
      {highlight && active ? (
        <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-accent-ink -mt-1">
          {icon}
        </div>
      ) : (
        <span>{icon}</span>
      )}
      <span className="text-11 font-semibold">{label}</span>
    </button>
  );
}
