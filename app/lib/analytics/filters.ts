import type { AnalyticsFilters } from "@/app/lib/analytics/types";

export function parseFilters(searchParams: URLSearchParams): AnalyticsFilters {
  return {
    startDate: searchParams.get("startDate") ?? "",
    endDate: searchParams.get("endDate") ?? "",
    client: searchParams.get("client") ?? "",
    campaign: searchParams.get("campaign") ?? "",
    source: searchParams.get("source") ?? "",
    search: searchParams.get("search") ?? ""
  };
}
