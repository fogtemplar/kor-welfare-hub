import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 앱인토스 미니앱(WebView SPA)이 cross-origin으로 /api/* 를 호출하므로 CORS 허용.
//
// 이전엔 Access-Control-Allow-Origin: * 를 모든 /api/* 에 붙였다.
// 그러면 /api/ai/recommend 도 무제한 공개되어, 임의의 사이트가
// 우리 GEMINI_API_KEY 로 추론을 돌릴 수 있다(요금은 우리 부담).
//
// 정책:
//  - 읽기 전용 데이터 API: 오리진 허용 목록 기반 (미설정 시 * 유지)
//  - /api/ai/*          : 허용 목록에 있는 오리진만. 목록 밖이면 CORS 헤더 없음
//                         → 브라우저가 cross-origin 호출을 차단한다.
const BUILT_IN_ORIGINS = [
  "https://kor-welfare-hub.apps.tossmini.com",
  "https://kor-welfare-hub.private-apps.tossmini.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const ALLOWED_ORIGINS = Array.from(
  new Set([
    ...BUILT_IN_ORIGINS,
    ...(process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ]),
);

function resolveOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");

  if (!origin) return null; // same-origin 요청은 CORS 헤더가 필요 없다
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return null;
}

function corsHeaders(allowOrigin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    ...(allowOrigin === "*" ? {} : { Vary: "Origin" }),
  };
}

export function middleware(req: NextRequest) {
  const allowOrigin = resolveOrigin(req);

  // 프리플라이트
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: allowOrigin ? 204 : 403,
      headers: allowOrigin ? corsHeaders(allowOrigin) : undefined,
    });
  }

  const res = NextResponse.next();
  if (allowOrigin) {
    for (const [k, v] of Object.entries(corsHeaders(allowOrigin))) res.headers.set(k, v);
  }
  return res;
}

export const config = { matcher: "/api/:path*" };
