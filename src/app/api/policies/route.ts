import { NextResponse } from "next/server";
import { CURATED_POLICIES } from "@/lib/data/policies";
import { fetchExternalPolicies } from "@/lib/scrapers/aggregate";
import { applyFilter, DEFAULT_FILTER } from "@/lib/filter";
import type { PolicyCategory } from "@/lib/types";

export const revalidate = 3600;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const external = await fetchExternalPolicies();
  const all = [...CURATED_POLICIES, ...external];

  const filter = {
    ...DEFAULT_FILTER,
    q: searchParams.get("q") ?? "",
    category: (searchParams.get("category") as PolicyCategory | "all") ?? "all",
    region: searchParams.get("region") ?? "전국",
    level: (searchParams.get("level") as "all" | "national" | "metro" | "local") ?? "all",
    age: searchParams.get("age") ? Number(searchParams.get("age")) : undefined,
    sort: (searchParams.get("sort") as "recent" | "alpha") ?? "recent",
  };

  const results = applyFilter(all, filter);
  return NextResponse.json({
    count: results.length,
    total: all.length,
    sources: {
      curated: CURATED_POLICIES.length,
      external: external.length,
    },
    items: results,
  });
}
