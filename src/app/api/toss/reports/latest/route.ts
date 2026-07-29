import { NextRequest, NextResponse } from "next/server";
import { getLatestUserReport, isReportStoreConfigured } from "@/lib/report-store";
import { openSession, TOSS_SESSION_COOKIE } from "@/lib/toss-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = openSession(request.cookies.get(TOSS_SESSION_COOKIE)?.value || "");
  if (!session) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  if (!isReportStoreConfigured()) return NextResponse.json({ report: null, configured: false });
  try {
    const report = await getLatestUserReport(session.profile.userKey);
    return NextResponse.json({ report, configured: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[toss/reports/latest] failed", error);
    return NextResponse.json({ error: "REPORT_RESTORE_FAILED" }, { status: 503 });
  }
}
