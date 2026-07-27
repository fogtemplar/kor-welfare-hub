import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * 토스 로그인 — 연결 끊기 콜백
 * ────────────────────────────────────────────────────────────────
 * 사용자가 토스에서 우리 서비스 연동을 해지하면 토스가 이 URL을 호출한다.
 * 우리는 해당 회원의 서버 저장 데이터를 파기하고 200을 돌려준다.
 *
 * 앱인토스 콘솔 설정값
 *   콜백 URL       https://(도메인)/api/toss/unlink
 *   HTTP 메서드    GET 또는 POST (둘 다 지원하므로 아무거나)
 *   Basic Auth 헤더 아래 TOSS_UNLINK_BASIC 으로 만든 값
 *
 * 설계 메모
 *  - 공식 규격의 userKey를 우선 확인하고, 콘솔 테스트 호환을 위해 일부 후보도 허용한다.
 *  - 존재하지 않는 회원이어도 200을 준다(멱등). 실패를 돌려주면 토스가
 *    재시도하거나 해지가 실패한 것처럼 보일 수 있고, 회원 존재 여부를
 *    외부에 알려주는 셈이 된다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 회원 식별자가 담겨 올 수 있는 키 후보 */
const IDENTIFIER_KEYS = [
  "userKey",
  "userId",
  "memberKey",
  "ci",
  "CI",
  "sub",
  "id",
];

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="toss-unlink"' },
  });
}

/** 길이가 달라도 안전하게 비교 (타이밍 공격 방지) */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    // 길이가 다르면 확실히 불일치지만, 비교 시간을 일정하게 유지한다
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

function checkAuth(req: Request): boolean {
  const expected = process.env.TOSS_UNLINK_BASIC?.trim();
  if (!expected) {
    console.error("[toss/unlink] TOSS_UNLINK_BASIC 미설정 — 모든 요청을 거부합니다");
    return false;
  }

  const header = req.headers.get("authorization") ?? "";
  const m = /^Basic\s+(.+)$/i.exec(header.trim());
  if (!m) return false;

  const got = m[1].trim();

  // 콘솔별 콜백 규격을 모두 지원한다.
  // - 유저정보 연동: Authorization: Basic {콘솔에 입력한 원문}
  // - 토스 로그인:   콘솔 값을 Base64 인코딩한 뒤 Authorization 헤더로 전달
  // 동일한 비밀값을 두 콘솔에서 공유해도 어느 쪽 요청인지에 따라 검증된다.
  const expectedB64 = Buffer.from(expected, "utf8").toString("base64");

  return safeEqual(got, expected) || safeEqual(got, expectedB64);
}

/** 쿼리스트링과 본문에서 회원 식별자를 찾아낸다 */
function extractIdentifier(
  params: URLSearchParams,
  body: Record<string, unknown> | null,
): { key: string; value: string } | null {
  for (const k of IDENTIFIER_KEYS) {
    const v = params.get(k);
    if (v) return { key: k, value: v };
  }
  if (body) {
    for (const k of IDENTIFIER_KEYS) {
      const v = body[k];
      if (typeof v === "string" && v) return { key: k, value: v };
      if (typeof v === "number") return { key: k, value: String(v) };
    }
  }
  return null;
}

/** 로그에 원문을 그대로 남기지 않도록 값을 가린다 */
function redact(v: unknown): string {
  const s = String(v ?? "");
  if (s.length <= 6) return "*".repeat(s.length);
  return `${s.slice(0, 3)}…${s.slice(-2)} (len=${s.length})`;
}

/**
 * 회원 데이터 파기.
 *
 * 지금은 서버에 저장하는 회원 데이터가 없어서(민감정보는 기기에만 보관,
 * 토스 로그인 미연동) 실제 삭제 대상이 없다. 알림 구독 테이블을 만든 뒤
 * 여기에 삭제 로직을 채운다.
 */
async function purgeMember(identifier: string): Promise<{ deleted: number }> {
  // TODO(알림 기능 구현 시): 아래를 실제 삭제로 교체
  //   await db.notificationSubscriptions.deleteMany({ where: { memberKey: identifier } });
  //   await db.members.delete({ where: { key: identifier } });
  void identifier;
  return { deleted: 0 };
}

async function handle(req: Request) {
  if (!checkAuth(req)) {
    console.warn("[toss/unlink] 인증 실패");
    return unauthorized();
  }

  const url = new URL(req.url);
  let body: Record<string, unknown> | null = null;

  if (req.method === "POST") {
    const ctype = req.headers.get("content-type") ?? "";
    try {
      if (ctype.includes("application/json")) {
        body = (await req.json()) as Record<string, unknown>;
      } else if (ctype.includes("application/x-www-form-urlencoded")) {
        body = Object.fromEntries(new URLSearchParams(await req.text()));
      } else {
        const raw = (await req.text()).trim();
        if (raw.startsWith("{")) body = JSON.parse(raw);
        else if (raw) body = Object.fromEntries(new URLSearchParams(raw));
      }
    } catch {
      body = null;
    }
  }

  const found = extractIdentifier(url.searchParams, body);

  if (!found) {
    // 식별자를 못 찾았다 = 우리가 아직 실제 페이로드 모양을 모른다는 뜻.
    // 콘솔 [테스트하기] 직후 이 로그를 보고 IDENTIFIER_KEYS 를 확정한다.
    console.warn(
      "[toss/unlink] 회원 식별자를 찾지 못했습니다. 실제 페이로드 구조:",
      JSON.stringify({
        method: req.method,
        queryKeys: [...url.searchParams.keys()],
        query: Object.fromEntries(
          [...url.searchParams.entries()].map(([k, v]) => [k, redact(v)]),
        ),
        bodyKeys: body ? Object.keys(body) : null,
        body: body
          ? Object.fromEntries(Object.entries(body).map(([k, v]) => [k, redact(v)]))
          : null,
      }),
    );
    // 그래도 200을 준다. 등록 단계의 [테스트하기]를 통과시켜야 하고,
    // 실패를 돌려주면 토스가 불필요하게 재시도한다.
    return new NextResponse(null, { status: 200 });
  }

  const result = await purgeMember(found.value);

  console.info(
    `[toss/unlink] 연결 해지 처리 — key=${found.key} value=${redact(found.value)} deleted=${result.deleted}`,
  );

  // 회원 존재 여부를 노출하지 않기 위해 항상 동일한 응답을 준다
  return new NextResponse(null, { status: 200 });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
