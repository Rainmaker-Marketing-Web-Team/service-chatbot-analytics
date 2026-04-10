import "server-only";

import { format, parseISO } from "date-fns";
import { analyticsSchema } from "@/app/lib/analytics/schema";
import type {
  AnalyticsDashboardResponse,
  AnalyticsFilters,
  FilterOptions,
  SourceBreakdownPoint,
  TimelinePoint
} from "@/app/lib/analytics/types";
import { getSupabaseAdminClient } from "@/app/lib/supabase/server";

type AnalyticsRecord = Record<string, unknown>;

function escapeLikeValue(value: string) {
  return value.replace(/[%_,]/g, (match) => `\\${match}`);
}

function createBaseQuery(selectClause: string) {
  const supabase = getSupabaseAdminClient();
  return supabase.from(analyticsSchema.tableName).select(selectClause, { count: "exact" });
}

function applyFilters<TQuery extends { gte: Function; lte: Function; eq: Function; or: Function }>(
  query: TQuery,
  filters: AnalyticsFilters
) {
  const { client, campaign, source, search, startDate, endDate } = filters;
  const { columns } = analyticsSchema;

  if (startDate) {
    query = query.gte(columns.createdAt, `${startDate}T00:00:00.000Z`);
  }

  if (endDate) {
    query = query.lte(columns.createdAt, `${endDate}T23:59:59.999Z`);
  }

  if (client) {
    query = query.eq(columns.client, client);
  }

  if (campaign) {
    query = query.eq(columns.campaign, campaign);
  }

  if (source) {
    query = query.eq(columns.source, source);
  }

  if (search) {
    const safeSearch = escapeLikeValue(search.trim());
    const textTargets = [
      columns.client,
      columns.campaign,
      columns.source,
      ...columns.search
    ];

    query = query.or(
      textTargets.map((column) => `${column}.ilike.%${safeSearch}%`).join(",")
    );
  }

  return query;
}

function normalizeRecord(record: AnalyticsRecord) {
  const normalized: AnalyticsRecord = {};

  analyticsSchema.dashboardColumns.forEach((column) => {
    normalized[column] = record[column] ?? null;
  });

  normalized.id = record[analyticsSchema.columns.id] ?? null;

  return normalized;
}

function buildTimeline(records: AnalyticsRecord[]): TimelinePoint[] {
  const bucket = new Map<string, number>();

  records.forEach((record) => {
    const rawDate = record[analyticsSchema.columns.createdAt];
    if (typeof rawDate !== "string") {
      return;
    }

    const date = parseISO(rawDate);
    const key = format(date, "yyyy-MM-dd");
    bucket.set(key, (bucket.get(key) ?? 0) + 1);
  });

  return [...bucket.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => ({
      label: format(parseISO(`${key}T00:00:00.000Z`), "MMM d"),
      count
    }));
}

function buildSourceBreakdown(records: AnalyticsRecord[]): SourceBreakdownPoint[] {
  const bucket = new Map<string, number>();

  records.forEach((record) => {
    const rawSource = record[analyticsSchema.columns.source];
    const key = typeof rawSource === "string" && rawSource.trim() ? rawSource : "Unknown";
    bucket.set(key, (bucket.get(key) ?? 0) + 1);
  });

  return [...bucket.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([label, count]) => ({ label, count }));
}

function buildFilterOptions(records: AnalyticsRecord[]): FilterOptions {
  const clients = new Set<string>();
  const campaigns = new Set<string>();
  const sources = new Set<string>();

  records.forEach((record) => {
    const client = record[analyticsSchema.columns.client];
    const campaign = record[analyticsSchema.columns.campaign];
    const source = record[analyticsSchema.columns.source];

    if (typeof client === "string" && client.trim()) {
      clients.add(client);
    }

    if (typeof campaign === "string" && campaign.trim()) {
      campaigns.add(campaign);
    }

    if (typeof source === "string" && source.trim()) {
      sources.add(source);
    }
  });

  return {
    clients: [...clients].sort((left, right) => left.localeCompare(right)),
    campaigns: [...campaigns].sort((left, right) => left.localeCompare(right)),
    sources: [...sources].sort((left, right) => left.localeCompare(right))
  };
}

function buildSummary(totalRecords: number, filteredRecords: number, records: AnalyticsRecord[]) {
  const clients = new Set<string>();
  const campaigns = new Set<string>();
  const sources = new Set<string>();

  records.forEach((record) => {
    const client = record[analyticsSchema.columns.client];
    const campaign = record[analyticsSchema.columns.campaign];
    const source = record[analyticsSchema.columns.source];

    if (typeof client === "string" && client.trim()) {
      clients.add(client);
    }

    if (typeof campaign === "string" && campaign.trim()) {
      campaigns.add(campaign);
    }

    if (typeof source === "string" && source.trim()) {
      sources.add(source);
    }
  });

  return {
    totalRecords,
    filteredRecords,
    filterCoverage: totalRecords > 0 ? filteredRecords / totalRecords : 0,
    uniqueClients: clients.size,
    uniqueCampaigns: campaigns.size,
    uniqueSources: sources.size
  };
}

async function fetchTotalRecordCount() {
  const { count, error } = await createBaseQuery(analyticsSchema.columns.id).limit(1);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function fetchFilterOptionSample() {
  const selectClause = [
    analyticsSchema.columns.client,
    analyticsSchema.columns.campaign,
    analyticsSchema.columns.source
  ].join(",");

  const { data, error } = await createBaseQuery(selectClause)
    .order(analyticsSchema.columns.createdAt, { ascending: false })
    .limit(analyticsSchema.aggregationSampleSize);

  if (error) {
    throw error;
  }

  return (data ?? []) as AnalyticsRecord[];
}

async function fetchFilteredRecordCount(filters: AnalyticsFilters) {
  const query = applyFilters(createBaseQuery(analyticsSchema.columns.id), filters).limit(1);
  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function fetchFilteredAggregationSample(filters: AnalyticsFilters) {
  const selectClause = [
    analyticsSchema.columns.id,
    analyticsSchema.columns.createdAt,
    analyticsSchema.columns.client,
    analyticsSchema.columns.campaign,
    analyticsSchema.columns.source
  ]
    .concat(analyticsSchema.columns.search)
    .join(",");

  const query = applyFilters(createBaseQuery(selectClause), filters)
    .order(analyticsSchema.columns.createdAt, { ascending: false })
    .limit(analyticsSchema.aggregationSampleSize);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as AnalyticsRecord[];
}

async function fetchFilteredRows(filters: AnalyticsFilters) {
  const selectClause = analyticsSchema.dashboardColumns.join(",");

  const query = applyFilters(createBaseQuery(selectClause), filters)
    .order(analyticsSchema.columns.createdAt, { ascending: false })
    .limit(analyticsSchema.pageSize);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as AnalyticsRecord[];
}

export async function getAnalyticsDashboard(filters: AnalyticsFilters): Promise<AnalyticsDashboardResponse> {
  const [totalRecords, filteredRecords, aggregationSample, rows, filterOptionSample] = await Promise.all([
    fetchTotalRecordCount(),
    fetchFilteredRecordCount(filters),
    fetchFilteredAggregationSample(filters),
    fetchFilteredRows(filters),
    fetchFilterOptionSample()
  ]);

  return {
    summary: buildSummary(totalRecords, filteredRecords, aggregationSample),
    timeline: buildTimeline(aggregationSample),
    sourceBreakdown: buildSourceBreakdown(aggregationSample),
    rows: rows.map(normalizeRecord),
    filterOptions: buildFilterOptions(filterOptionSample),
    meta: {
      generatedAt: new Date().toISOString(),
      tableName: analyticsSchema.tableName,
      tableColumns: analyticsSchema.dashboardColumns,
      pageSize: analyticsSchema.pageSize,
      aggregationSampleSize: analyticsSchema.aggregationSampleSize
    }
  };
}

export async function getExportRows(filters: AnalyticsFilters) {
  const selectClause = analyticsSchema.dashboardColumns.join(",");
  const query = applyFilters(createBaseQuery(selectClause), filters)
    .order(analyticsSchema.columns.createdAt, { ascending: false })
    .limit(analyticsSchema.exportLimit);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as AnalyticsRecord[]).map(normalizeRecord);
}
