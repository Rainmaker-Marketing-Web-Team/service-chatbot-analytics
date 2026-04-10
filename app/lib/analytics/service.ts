import "server-only";

import { format, parseISO } from "date-fns";
import type {
  AnalyticsDashboardResponse,
  AnalyticsFilters,
  AnalyticsInsightItem,
  AnalyticsSummary,
  FilterOptions,
  SourceBreakdownPoint,
  TimelinePoint
} from "@/app/lib/analytics/types";
import { queryPostgres } from "@/app/lib/postgres/server";
import { formatHourRange } from "@/app/lib/utils/format";

type SummaryRow = {
  filtered_records: number;
  unique_clients: number;
  unique_campaigns: number;
  unique_sources: number;
};

type CountRow = {
  count: number;
};

type TimelineRow = {
  bucket: string;
  count: number;
};

type LabelCountRow = {
  label: string;
  count: number;
};

type HourRow = {
  hour: number;
  count: number;
};

type OptionRow = {
  value: string | null;
};

function escapeLikeValue(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function buildWhere(filters: AnalyticsFilters, extraConditions: string[] = []) {
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
    const placeholder = addValue(`%${escapeLikeValue(filters.search.trim())}%`);
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

function buildDataset(filters: AnalyticsFilters, extraConditions: string[] = []) {
  const where = buildWhere(filters, extraConditions);

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

async function fetchTotalMessages() {
  const result = await queryPostgres<CountRow>("SELECT COUNT(*)::int AS count FROM public.chat_messages");
  return result.rows[0]?.count ?? 0;
}

async function fetchSummary(filters: AnalyticsFilters): Promise<AnalyticsSummary> {
  const dataset = buildDataset(filters);
  const [totalRecords, summaryResult] = await Promise.all([
    fetchTotalMessages(),
    queryPostgres<SummaryRow>(
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

  const row = summaryResult.rows[0];
  const filteredRecords = row?.filtered_records ?? 0;

  return {
    totalRecords,
    filteredRecords,
    filterCoverage: totalRecords > 0 ? filteredRecords / totalRecords : 0,
    uniqueClients: row?.unique_clients ?? 0,
    uniqueCampaigns: row?.unique_campaigns ?? 0,
    uniqueSources: row?.unique_sources ?? 0
  };
}

async function fetchTimeline(filters: AnalyticsFilters): Promise<TimelinePoint[]> {
  const dataset = buildDataset(filters);
  const result = await queryPostgres<TimelineRow>(
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

async function fetchSourceBreakdown(filters: AnalyticsFilters): Promise<SourceBreakdownPoint[]> {
  const dataset = buildDataset(filters);
  const result = await queryPostgres<LabelCountRow>(
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

async function fetchTopQuestions(filters: AnalyticsFilters): Promise<AnalyticsInsightItem[]> {
  const dataset = buildDataset(filters, ["LOWER(cm.role) = 'user'", "CHAR_LENGTH(TRIM(cm.content)) > 0"]);
  const result = await queryPostgres<LabelCountRow>(
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

async function fetchBusiestTimes(filters: AnalyticsFilters): Promise<AnalyticsInsightItem[]> {
  const dataset = buildDataset(filters);
  const result = await queryPostgres<HourRow>(
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

async function fetchFilterOptions(): Promise<FilterOptions> {
  const [clients, campaigns, sources] = await Promise.all([
    queryPostgres<OptionRow>(
      `
        SELECT DISTINCT p.name AS value
        FROM public.projects p
        INNER JOIN public.chat_sessions cs ON cs.project_id = p.id
        INNER JOIN public.chat_messages cm ON cm.session_id = cs.id
        WHERE CHAR_LENGTH(TRIM(p.name)) > 0
        ORDER BY 1
      `
    ),
    queryPostgres<OptionRow>(
      `
        SELECT DISTINCT cs.channel AS value
        FROM public.chat_sessions cs
        INNER JOIN public.chat_messages cm ON cm.session_id = cs.id
        WHERE cs.channel IS NOT NULL AND CHAR_LENGTH(TRIM(cs.channel)) > 0
        ORDER BY 1
      `
    ),
    queryPostgres<OptionRow>(
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

export async function getAnalyticsDashboard(filters: AnalyticsFilters): Promise<AnalyticsDashboardResponse> {
  const [summary, timeline, sourceBreakdown, topQuestions, busiestTimes, filterOptions] = await Promise.all([
    fetchSummary(filters),
    fetchTimeline(filters),
    fetchSourceBreakdown(filters),
    fetchTopQuestions(filters),
    fetchBusiestTimes(filters),
    fetchFilterOptions()
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
