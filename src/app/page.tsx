import { CURATED_POLICIES } from "@/lib/data/policies";
import { Dashboard } from "@/components/Dashboard";
import { fetchExternalPolicies } from "@/lib/scrapers/aggregate";

export const revalidate = 3600;

export default async function Page() {
  const external = await fetchExternalPolicies();
  const all = [...CURATED_POLICIES, ...external];
  return <Dashboard policies={all} />;
}
