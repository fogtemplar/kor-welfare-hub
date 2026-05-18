import { NextResponse } from "next/server";
import { fetchExternalPolicies } from "@/lib/scrapers/aggregate";

export const revalidate = 0;

export async function GET() {
  const items = await fetchExternalPolicies();
  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    count: items.length,
    items,
  });
}
