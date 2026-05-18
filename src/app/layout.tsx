import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "복지허브 — 한눈에 보는 정부·지자체 정책 및 혜택",
  description:
    "한국 정부와 지자체가 운영하는 정책, 지원금, 복지, 혜택을 카테고리·지역·대상별로 한 페이지에서 탐색하세요.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
