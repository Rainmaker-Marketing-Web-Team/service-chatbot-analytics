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
import { queryPostgres } from "@/app/lib/postgres/server";

type AnalyticsRecord = Record<string, unknown>;

function escapeLikeValue(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
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
    const normalizedDate =
      typeof rawDate === "string" ? rawDate : rawDate instanceof Date ? rawDate.toISOString() : null;

    if (!normalizedDate) {
      return;
    }

    const date = parseISO(normalizedDate);
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

function shouldUsePostgres() {
  return Boolean(process.env.DATABASE_URL);
}

function buildPostgresWhere(filters: AnalyticsFilters) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  const addValue = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.startDate) {
    conditions.push(`cm.created_at >= ${addValue(`${filters.startDate}T00:00:00.000Z`)}`);
  }

  if (filters.endDate) {
    conditions.push(`cm.created_at <= ${addValue(`${filters.endDate}T23:59:59.999Z`)}`);
  }

  if (filters.client) {
    conditions.push(`p.name = ${addValue(filters.client)}`);
  }

  if (filters.campaign) {
    conditions.push(`COALESCE(cs.channel, '') = ${addValue(filters.campaign)}`);
  }

  if (filters.source) {
    conditions.push(`cm.role = ${addValue(filters.source)}`);
  }

  if (filters.search.trim()) {
    const searchPattern = `%${escapeLikeValue(filters.search.trim())}%`;
    const placeholder = addValue(searchPattern);
    conditions.push(`(
      p.name ILIKE ${placeholder} ESCAPE '\\'
      OR p.slug ILIKE ${placeholder} ESCAPE '\\'
      OR COALESCE(cs.channel, '') ILIKE ${placeholder} ESCAPE '\\'
      OR COALESCE(cs.external_user_id, '') ILIKE ${placeholder} ESCAPE '\\'
      OR cs.external_session_id ILIKE ${placeholder} ESCAPE '\\'
      OR cm.role ILIKE ${placeholder} ESCAPE '\\'
      OR cm.content ILIKE ${placeholder} ESCAPE '\\'
    )`);
  }

  return {
    text: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    values
  };
}

function buildPostgresSelect() {
  return `
    SELECT
      cm.id,
      cm.created_at::text AS created_at,
      p.name AS project_name,
      p.slug AS project_slug,
      cs.channel,
      cm.role,
      cs.external_user_id,
      cs.external_session_id,
      cm.content
    FROM public.chat_messages cm
    INNER JOIN public.chat_sessions cs ON cs.id = cm.session_id
    INNER JOIN public.projects p ON p.id = cs.project_id
  `;
}

async function fetchPostgresRows(filters: AnalyticsFilters, limit: number) {
  const where = buildPostgresWhere(filters);
  const limitPlaceholder = `$${where.values.length + 1}`;
  const sql = `
    ${buildPostgresSelect()}
    ${where.text}
    ORDER BY cm.created_at DESC
    LIMIT ${limitPlaceholder}
  `;

  const result = await queryPostgres<AnalyticsRecord>(sql, [...where.values, limit]);
  return result.rows;
}

async function fetchPostgresTotalRecordCount() {
  const result = await queryPostgres<{ count: string }>("SELECT COUNT(*)::text AS count FROM public.chat_messages");
  return Number(result.rows[0]?.count ?? 0);
}

async function fetchPostgresFilteredRecordCount(filters: AnalyticsFilters) {
  const where = buildPostgresWhere(filters);
  const sql = `
    SELECT COUNT(*)::text AS count
    FROM public.chat_messages cm
    INNER JOIN public.chat_sessions cs ON cs.id = cm.session_id
    INNER JOIN public.projects p ON p.id = cs.project_id
    ${where.text}
  `;

  const result = await queryPostgres<{ count: string }>(sql, where.values);
  return Number(result.rows[0]?.count ?? 0);
}

async function fetchPostgresFilterOptionSample() {
  return fetchPostgresRows(
    {
      startDate: "",
      endDate: "",
      client: "",
      campaign: "",
      source: "",
      search: ""
    },
    analyticsSchema.aggregationSampleSize
  );
}

function createSupabaseBaseQuery(selectClause: string) {
  const supabase = getSupabaseAdminClient();
  return supabase.from(analyticsSchema.tableName).select(selectClause, { count: "exact" });
}

function applySupabaseFilters<TQuery extends { gte: Function; lte: Function; eq: Function; or: Function }>(
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
    const textTargets = [columns.client, columns.campaign, columns.source, ...columns.search];

    query = query.or(textTargets.map((column) => `${column}.ilike.%${safeSearch}%`).join(","));
  }

  return query;
}

async function fetchSupabaseTotalRecordCount() {
  const { count, error } = await createSupabaseBaseQuery(analyticsSchema.columns.id).limit(1);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function fetchSupabaseFilterOptionSample() {
  const selectClause = [
    analyticsSchema.columns.client,
    analyticsSchema.columns.campaign,
    analyticsSchema.columns.source
  ].join(",");

  const { data, error } = await createSupabaseBaseQuery(selectClause)
    .order(analyticsSchema.columns.createdAt, { ascending: false })
    .limit(analyticsSchema.aggregationSampleSize);

  if (error) {
    throw error;
  }

  return (data ?? []) as AnalyticsRecord[];
}

async function fetchSupabaseFilteredRecordCount(filters: AnalyticsFilters) {
  const query = applySupabaseFilters(createSupabaseBaseQuery(analyticsSchema.columns.id), filters).limit(1);
  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function fetchSupabaseFilteredAggregationSample(filters: AnalyticsFilters) {
  const selectClause = [
    analyticsSchema.columns.id,
    analyticsSchema.columns.createdAt,
    analyticsSchema.columns.client,
    analyticsSchema.columns.campaign,
    analyticsSchema.columns.source
  ]
    .concat(analyticsSchema.columns.search)
    .join(",");

  const query = applySupabaseFilters(createSupabaseBaseQuery(selectClause), filters)
    .order(analyticsSchema.columns.createdAt, { ascending: false })
    .limit(analyticsSchema.aggregationSampleSize);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as AnalyticsRecord[];
}

async function fetchSupabaseFilteredRows(filters: AnalyticsFilters) {
  return fetchSupabaseRows(filters, analyticsSchema.pageSize);
}

async function fetchSupabaseRows(filters: AnalyticsFilters, limit: number) {
  const selectClause = analyticsSchema.dashboardColumns.join(",");

  const query = applySupabaseFilters(createSupabaseBaseQuery(selectClause), filters)
    .order(analyticsSchema.columns.createdAt, { ascending: false })
    .limit(limit);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as AnalyticsRecord[];
}

export async function getAnalyticsDashboard(filters: AnalyticsFilters): Promise<AnalyticsDashboardResponse> {
  const [totalRecords, filteredRecords, aggregationSample, rows, filterOptionSample] = shouldUsePostgres()
    ? await Promise.all([
        fetchPostgresTotalRecordCount(),
        fetchPostgresFilteredRecordCount(filters),
        fetchPostgresRows(filters, analyticsSchema.aggregationSampleSize),
        fetchPostgresRows(filters, analyticsSchema.pageSize),
        fetchPostgresFilterOptionSample()
      ])
    : await Promise.all([
        fetchSupabaseTotalRecordCount(),
        fetchSupabaseFilteredRecordCount(filters),
        fetchSupabaseFilteredAggregationSample(filters),
        fetchSupabaseFilteredRows(filters),
        fetchSupabaseFilterOptionSample()
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
  const rows = shouldUsePostgres()
    ? await fetchPostgresRows(filters, analyticsSchema.exportLimit)
    : await fetchSupabaseRows(filters, analyticsSchema.exportLimit);

  return rows.map(normalizeRecord);
}
