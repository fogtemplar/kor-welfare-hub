import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 앱인토스 미니앱(WebView SPA)이 cross-origin으로 /api/* 를 호출한다.
const BUILT_IN_ORIGINS = [
  "https://apps-in-toss.toss.im",
  "https://bokji.apps.tossmini.com",
  "https://bokji.private-apps.tossmini.com",
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
      .map((value) => value.trim())
      .filter(Boolean),
  ]),
);

function resolveOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;

  // 앱인토스 콘솔 콜백 테스트에만 공식 Toss 서브도메인을 추가 허용한다.
  if (req.nextUrl.pathname === "/api/toss/unlink") {
    try {
      const { protocol, hostname } = new URL(origin);
      if (
        protocol === "https:" &&
        (hostname === "toss.im" || hostname.endsWith(".toss.im"))
      ) {
        return origin;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function corsHeaders(allowOrigin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function proxy(req: NextRequest) {
  const allowOrigin = resolveOrigin(req);

  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: allowOrigin ? 204 : 403,
      headers: allowOrigin ? corsHeaders(allowOrigin) : undefined,
    });
  }

  const response = NextResponse.next();
  if (allowOrigin) {
    for (const [key, value] of Object.entries(corsHeaders(allowOrigin))) {
      response.headers.set(key, value);
    }
  }
  return response;
}

export const config = { matcher: "/api/:path*" };
