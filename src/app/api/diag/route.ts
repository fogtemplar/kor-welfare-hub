import { NextResponse } from "next/server";
import { fetchBokjiroPolicies } from "@/lib/scrapers/bokjiro";
import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const out: Record<string, any> = { at: new Date().toISOString(), cwd: process.cwd() };

  // 1. .cache 파일 상태 확인 (Vercel filesystem 가시성)
  const cachePath = path.join(process.cwd(), ".cache", "bokjiro.json");
  try {
    const stat = await fs.stat(cachePath);
    out.cache_file = { exists: true, size: stat.size, mtime: stat.mtime };
    const raw = await fs.readFile(cachePath, "utf8").catch(() => "");
    const parsed = JSON.parse(raw);
    out.cache_content = {
      fetchedAt: parsed.fetchedAt,
      itemCount: Array.isArray(parsed.items) ? parsed.items.length : -1,
    };
  } catch (e: any) {
    out.cache_file = { exists: false, error: String(e?.message ?? e) };
  }

  // 2. forceRefresh로 스크래퍼 직접 호출
  const t1 = Date.now();
  try {
    const items = await fetchBokjiroPolicies({ forceRefresh: true });
    out.fetchBokjiroPolicies_forceRefresh = {
      count: items.length,
      took_ms: Date.now() - t1,
      firstId: items[0]?.id,
      firstTitle: items[0]?.title,
    };
  } catch (e: any) {
    out.fetchBokjiroPolicies_error = String(e?.message ?? e);
  }

  return NextResponse.json(out);
}
