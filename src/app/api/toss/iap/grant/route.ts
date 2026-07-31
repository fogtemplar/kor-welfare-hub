import { NextRequest, NextResponse } from "next/server";
import { getTossIapOrderStatus } from "@/lib/toss-login";
import { openSession, TOSS_SESSION_COOKIE } from "@/lib/toss-session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { orderId?: string; sku?: string };
  try {
    body = await request.json() as { orderId?: string; sku?: string };
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const orderId = String(body.orderId || "").trim();
  const requestedSku = String(body.sku || "").trim();
  const expectedSku = process.env.TOSS_REPORT_SKU?.trim() || "ait.0000037018.4b1ec874.bbc410aefe.5308190597";
  if (orderId.length < 8 || requestedSku !== expectedSku) {
    return NextResponse.json({ error: "INVALID_GRANT_REQUEST" }, { status: 400 });
  }

  const session = openSession(request.cookies.get(TOSS_SESSION_COOKIE)?.value || "");
  if (!session) return NextResponse.json({ error: "TOSS_LOGIN_REQUIRED" }, { status: 401 });

  try {
    const order = await getTossIapOrderStatus(orderId, session.profile.userKey);
    const validStatus = order.status === "PAYMENT_COMPLETED" || order.status === "PURCHASED";
    if (!validStatus || order.sku !== expectedSku) {
      return NextResponse.json({ error: "PAYMENT_NOT_VERIFIED", status: order.status }, { status: 402 });
    }
    return NextResponse.json({ granted: true, orderId });
  } catch (error) {
    console.error("[toss/iap/grant] order verification failed", error);
    return NextResponse.json({ error: "PAYMENT_VERIFICATION_FAILED" }, { status: 503 });
  }
}
