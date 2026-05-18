import { NextResponse } from "next/server";
import { fetchBokjiroPolicies } from "@/lib/scrapers/bokjiro";
import { fetchYouthcenterPolicies } from "@/lib/scrapers/youthcenter";
import { fetchKStartupPolicies } from "@/lib/scrapers/kstartup";
import { fetchGovServicePolicies } from "@/lib/scrapers/govService";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const env = {
    BOKJIRO_API_KEY: !!process.env.BOKJIRO_API_KEY,
    YOUTHCENTER_API_KEY: !!process.env.YOUTHCENTER_API_KEY,
    KSTARTUP_API_KEY: !!process.env.KSTARTUP_API_KEY,
    GOV_SERVICE_API_KEY: !!process.env.GOV_SERVICE_API_KEY,
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
  };

  const results: Record<string, { count: number; took_ms: number; error?: string }> = {};

  for (const [name, fn] of [
    ["bokjiro", fetchBokjiroPolicies],
    ["youthcenter", fetchYouthcenterPolicies],
    ["kstartup", fetchKStartupPolicies],
    ["govService", fetchGovServicePolicies],
  ] as const) {
    const t = Date.now();
    try {
      const items = await fn({ forceRefresh: true });
      results[name] = { count: items.length, took_ms: Date.now() - t };
    } catch (e: any) {
      results[name] = { count: 0, took_ms: Date.now() - t, error: String(e?.message ?? e) };
    }
  }

  return NextResponse.json({ env, results, at: new Date().toISOString() });
}
