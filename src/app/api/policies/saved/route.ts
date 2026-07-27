import { NextResponse } from "next/server";
import { CURATED_POLICIES } from "@/lib/data/policies";
import { fetchExternalPolicies } from "@/lib/scrapers/aggregate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SAVED = 300;

export async function POST(req: Request) {
  let body: { ids?: unknown };
  try {
    body = await req.json() as { ids?: unknown };
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.ids)) {
    return NextResponse.json({ error: "IDS_REQUIRED" }, { status: 400 });
  }

  const ids = body.ids
    .filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 200)
    .slice(0, MAX_SAVED);
  const wanted = new Set(ids);
  if (wanted.size === 0) return NextResponse.json({ items: [] });

  const all = [...CURATED_POLICIES, ...(await fetchExternalPolicies())];
  const byId = new Map(all.filter((policy) => wanted.has(policy.id)).map((policy) => [policy.id, policy]));
  const items = ids.map((id) => byId.get(id)).filter(Boolean);

  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
