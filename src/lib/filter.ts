import type { Policy, PolicyCategory } from "@/lib/types";

export type FilterState = {
  q: string;
  category: PolicyCategory | "all";
  region: string;
  level: "all" | "national" | "metro" | "local";
  age?: number;
  sort: "recent" | "alpha";
};

export const DEFAULT_FILTER: FilterState = {
  q: "",
  category: "all",
  region: "전국",
  level: "all",
  age: undefined,
  sort: "recent",
};

export function applyFilter(policies: Policy[], f: FilterState): Policy[] {
  const q = f.q.trim().toLowerCase();
  const out = policies.filter((p) => {
    if (f.category !== "all" && p.category !== f.category) return false;
    if (f.level !== "all" && p.level !== f.level) return false;
    if (f.region !== "전국") {
      if (p.region && p.region !== "전국" && p.region !== f.region) return false;
    }
    if (typeof f.age === "number") {
      if (typeof p.ageMin === "number" && f.age < p.ageMin) return false;
      if (typeof p.ageMax === "number" && f.age > p.ageMax) return false;
    }
    if (q) {
      const hay = [
        p.title,
        p.summary,
        p.agency,
        p.benefit,
        p.eligibility,
        p.tags?.join(" ") ?? "",
        p.audience.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  out.sort((a, b) => {
    if (f.sort === "alpha") return a.title.localeCompare(b.title, "ko");
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  return out;
}
