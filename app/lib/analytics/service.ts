import "server-only";

import { format, parseISO } from "date-fns";
import { analyticsSchema } from "@/app/lib/analytics/schema";
import type {
  AnalyticsDashboardResponse,
  AnalyticsFilters,
  AnalyticsInsightItem,
  AnalyticsSummary,
  FilterOptions,
  SourceBreakdownPoint,
  TimelinePoint
} from "@/app/lib/analytics/types";
import { getSupabaseAdminClient } from "@/app/lib/supabase/server";
import { queryPostgres } from "@/app/lib/postgres/server";
import { formatHourRange } from "@/app/lib/utils/format";

type AnalyticsRecord = Record<string, unknown>;

type PostgresSummaryRow = {
  filtered_records: number;
  unique_clients: number;
  unique_campaigns: number;
  unique_sources: number;
};

type PostgresCountRow = {
  count: number;
};

type PostgresTimelineRow = {
  bucket: string;
  count: number;
};

type PostgresInsightRow = {
  label: string;
  count: number;
};

type PostgresHourRow = {
  hour: number;
  count: number;
};

type PostgresOptionRow = {
  value: string | null;
};

function escapeLikeValue(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function normalizeRecordDate(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return null;
}

function buildTimeline(records: AnalyticsRecord[]): TimelinePoint[] {
  const bucket = new Map<string, number>();

  records.forEach((record) => {
    const normalizedDate = normalizeRecordDate(record[analyticsSchema.columns.createdAt]);

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

function buildSummary(totalRecords: number, filteredRecords: number, records: AnalyticsRecord[]): AnalyticsSummary {
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

function buildTopQuestions(records: AnalyticsRecord[]): AnalyticsInsightItem[] {
  const bucket = new Map<string, { label: string; count: number }>();

  records.forEach((record) => {
    const role = record[analyticsSchema.columns.source];
    const content = record.content;

    if (typeof role !== "string" || role.toLowerCase() !== "user") {
      return;
    }

    if (typeof content !== "string") {
      return;
    }

    const cleaned = content.replace(/\s+/g, " ").trim();

    if (!cleaned) {
      return;
    }

    const key = cleaned.toLowerCase();
    const current = bucket.get(key);

    if (current) {
      current.count += 1;
      return;
    }

    bucket.set(key, { label: cleaned, count: 1 });
  });

  return [...bucket.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 5)
    .map(({ label, count }) => ({ label, count }));
}

function buildBusiestTimes(records: AnalyticsRecord[]): AnalyticsInsightItem[] {
  const bucket = new Map<number, number>();

  records.forEach((record) => {
    const normalizedDate = normalizeRecordDate(record[analyticsSchema.columns.createdAt]);

    if (!normalizedDate) {
      return;
    }

    const date = parseISO(normalizedDate);
    const hour = date.getUTCHours();
    bucket.set(hour, (bucket.get(hour) ?? 0) + 1);
  });

  return [...bucket.entries()]
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])
    .slice(0, 5)
    .map(([hour, count]) => ({
      label: formatHourRange(hour),
      count
    }));
}

function shouldUsePostgres() {
  return Boolean(process.env.DATABASE_URL);
}

function buildPostgresWhere(filters: AnalyticsFilters, extraConditions: string[] = []) {
  const conditions: string[] = [...extraConditions];
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

function buildPostgresFrom(filters: AnalyticsFilters, extraConditions: string[] = []) {
  const where = buildPostgresWhere(filters, extraConditions);

  return {
    sql: `
      FROM public.chat_messages cm
      INNER JOIN public.chat_sessions cs ON cs.id = cm.session_id
      INNER JOIN public.projects p ON p.id = cs.project_id
      ${where.text}
    `,
    values: where.values
  };
}

async function fetchPostgresTotalRecordCount() {
  const result = await queryPostgres<PostgresCountRow>("SELECT COUNT(*)::int AS count FROM public.chat_messages");
  return result.rows[0]?.count ?? 0;
}

async function fetchPostgresSummary(filters: AnalyticsFilters): Promise<AnalyticsSummary> {
  const dataset = buildPostgresFrom(filters);
  const [totalRecordsResult, filteredSummaryResult] = await Promise.all([
    fetchPostgresTotalRecordCount(),
    queryPostgres<PostgresSummaryRow>(
      `
        SELECT
          COUNT(*)::int AS filtered_records,
          COUNT(DISTINCT p.id)::int AS unique_clients,
          COUNT(DISTINCT NULLIF(COALESCE(cs.channel, ''), ''))::int AS unique_campaigns,
          COUNT(DISTINCT NULLIF(COALESCE(cm.role, ''), ''))::int AS unique_sources
        ${dataset.sql}
      `,
      dataset.values
    )
  ]);

  const row = filteredSummaryResult.rows[0];
  const filteredRecords = row?.filtered_records ?? 0;

  return {
    totalRecords: totalRecordsResult,
    filteredRecords,
    filterCoverage: totalRecordsResult > 0 ? filteredRecords / totalRecordsResult : 0,
    uniqueClients: row?.unique_clients ?? 0,
    uniqueCampaigns: row?.unique_campaigns ?? 0,
    uniqueSources: row?.unique_sources ?? 0
  };
}

async function fetchPostgresTimeline(filters: AnalyticsFilters): Promise<TimelinePoint[]> {
  const dataset = buildPostgresFrom(filters);
  const result = await queryPostgres<PostgresTimelineRow>(
    `
      SELECT TO_CHAR(DATE_TRUNC('day', cm.created_at), 'YYYY-MM-DD') AS bucket, COUNT(*)::int AS count
      ${dataset.sql}
      GROUP BY 1
      ORDER BY 1
    `,
    dataset.values
  );

  return result.rows.map((row) => ({
    label: format(parseISO(`${row.bucket}T00:00:00.000Z`), "MMM d"),
    count: row.count
  }));
}

async function fetchPostgresSourceBreakdown(filters: AnalyticsFilters): Promise<SourceBreakdownPoint[]> {
  const dataset = buildPostgresFrom(filters);
  const result = await queryPostgres<PostgresInsightRow>(
    `
      SELECT COALESCE(NULLIF(cm.role, ''), 'Unknown') AS label, COUNT(*)::int AS count
      ${dataset.sql}
      GROUP BY 1
      ORDER BY count DESC, label ASC
      LIMIT 8
    `,
    dataset.values
  );

  return result.rows;
}

async function fetchPostgresTopQuestions(filters: AnalyticsFilters): Promise<AnalyticsInsightItem[]> {
  const dataset = buildPostgresFrom(filters, ["LOWER(cm.role) = 'user'", "CHAR_LENGTH(TRIM(cm.content)) > 0"]);
  const result = await queryPostgres<PostgresInsightRow>(
    `
      SELECT MIN(cleaned_content) AS label, COUNT(*)::int AS count
      FROM (
        SELECT
          TRIM(REGEXP_REPLACE(cm.content, '\\s+', ' ', 'g')) AS cleaned_content,
          LOWER(TRIM(REGEXP_REPLACE(cm.content, '\\s+', ' ', 'g'))) AS normalized_content
        ${dataset.sql}
      ) prompts
      GROUP BY normalized_content
      ORDER BY count DESC, label ASC
      LIMIT 5
    `,
    dataset.values
  );

  return result.rows;
}

async function fetchPostgresBusiestTimes(filters: AnalyticsFilters): Promise<AnalyticsInsightItem[]> {
  const dataset = buildPostgresFrom(filters);
  const result = await queryPostgres<PostgresHourRow>(
    `
      SELECT EXTRACT(HOUR FROM cm.created_at AT TIME ZONE 'UTC')::int AS hour, COUNT(*)::int AS count
      ${dataset.sql}
      GROUP BY 1
      ORDER BY count DESC, hour ASC
      LIMIT 5
    `,
    dataset.values
  );

  return result.rows.map((row) => ({
    label: formatHourRange(row.hour),
    count: row.count
  }));
}

async function fetchPostgresFilterOptions(): Promise<FilterOptions> {
  const [clients, campaigns, sources] = await Promise.all([
    queryPostgres<PostgresOptionRow>(
      `
        SELECT DISTINCT p.name AS value
        FROM public.projects p
        INNER JOIN public.chat_sessions cs ON cs.project_id = p.id
        INNER JOIN public.chat_messages cm ON cm.session_id = cs.id
        WHERE CHAR_LENGTH(TRIM(p.name)) > 0
        ORDER BY 1
      `
    ),
    queryPostgres<PostgresOptionRow>(
      `
        SELECT DISTINCT cs.channel AS value
        FROM public.chat_sessions cs
        INNER JOIN public.chat_messages cm ON cm.session_id = cs.id
        WHERE cs.channel IS NOT NULL AND CHAR_LENGTH(TRIM(cs.channel)) > 0
        ORDER BY 1
      `
    ),
    queryPostgres<PostgresOptionRow>(
      `
        SELECT DISTINCT cm.role AS value
        FROM public.chat_messages cm
        WHERE cm.role IS NOT NULL AND CHAR_LENGTH(TRIM(cm.role)) > 0
        ORDER BY 1
      `
    )
  ]);

  return {
    clients: clients.rows.flatMap((row) => (row.value ? [row.value] : [])),
    campaigns: campaigns.rows.flatMap((row) => (row.value ? [row.value] : [])),
    sources: sources.rows.flatMap((row) => (row.value ? [row.value] : []))
  };
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

  if (search.trim()) {
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
  const selectColumns: string[] = [
    analyticsSchema.columns.id,
    analyticsSchema.columns.createdAt,
    analyticsSchema.columns.client,
    analyticsSchema.columns.campaign,
    analyticsSchema.columns.source,
    ...analyticsSchema.columns.search
  ];
  const selectClause = selectColumns.join(",");

  const query = applySupabaseFilters(createSupabaseBaseQuery(selectClause), filters)
    .order(analyticsSchema.columns.createdAt, { ascending: false })
    .limit(analyticsSchema.aggregationSampleSize);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as AnalyticsRecord[];
}

export async function getAnalyticsDashboard(filters: AnalyticsFilters): Promise<AnalyticsDashboardResponse> {
  if (shouldUsePostgres()) {
    const [summary, timeline, sourceBreakdown, topQuestions, busiestTimes, filterOptions] = await Promise.all([
      fetchPostgresSummary(filters),
      fetchPostgresTimeline(filters),
      fetchPostgresSourceBreakdown(filters),
      fetchPostgresTopQuestions(filters),
      fetchPostgresBusiestTimes(filters),
      fetchPostgresFilterOptions()
    ]);

    return {
      summary,
      timeline,
      sourceBreakdown,
      topQuestions,
      busiestTimes,
      filterOptions,
      meta: {
        generatedAt: new Date().toISOString()
      }
    };
  }

  const [totalRecords, filteredRecords, aggregationSample, filterOptionSample] = await Promise.all([
    fetchSupabaseTotalRecordCount(),
    fetchSupabaseFilteredRecordCount(filters),
    fetchSupabaseFilteredAggregationSample(filters),
    fetchSupabaseFilterOptionSample()
  ]);

  return {
    summary: buildSummary(totalRecords, filteredRecords, aggregationSample),
    timeline: buildTimeline(aggregationSample),
    sourceBreakdown: buildSourceBreakdown(aggregationSample),
    topQuestions: buildTopQuestions(aggregationSample),
    busiestTimes: buildBusiestTimes(aggregationSample),
    filterOptions: buildFilterOptions(filterOptionSample),
    meta: {
      generatedAt: new Date().toISOString()
    }
  };
}
