import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 앱인토스 미니앱(WebView SPA)이 cross-origin으로 /api/* 를 호출하므로 CORS 허용.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function middleware(req: NextRequest) {
  // 프리플라이트
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

export const config = { matcher: "/api/:path*" };
