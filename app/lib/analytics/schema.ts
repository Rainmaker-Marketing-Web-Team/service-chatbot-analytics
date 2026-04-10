export const analyticsSchema = {
  // Keep your real Supabase table and column names configurable through env vars
  // so the rest of the application can stay stable across schema changes.
  tableName: process.env.SUPABASE_ANALYTICS_TABLE ?? "analytics_events",
  columns: {
    id: process.env.SUPABASE_ANALYTICS_ID_COLUMN ?? "id",
    createdAt: process.env.SUPABASE_ANALYTICS_CREATED_AT_COLUMN ?? "created_at",
    client: process.env.SUPABASE_ANALYTICS_CLIENT_COLUMN ?? "client_name",
    campaign: process.env.SUPABASE_ANALYTICS_CAMPAIGN_COLUMN ?? "campaign_name",
    source: process.env.SUPABASE_ANALYTICS_SOURCE_COLUMN ?? "source_platform",
    search: [
      process.env.SUPABASE_ANALYTICS_SEARCH_COLUMN_PRIMARY ?? "message_text",
      process.env.SUPABASE_ANALYTICS_SEARCH_COLUMN_SECONDARY ?? "external_id"
    ].filter(Boolean)
  },
  dashboardColumns: (
    process.env.SUPABASE_ANALYTICS_TABLE_COLUMNS ??
    "created_at,client_name,campaign_name,source_platform,message_text,external_id"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  pageSize: Number(process.env.ANALYTICS_DASHBOARD_PAGE_SIZE ?? 50),
  aggregationSampleSize: Number(process.env.ANALYTICS_AGGREGATION_SAMPLE_SIZE ?? 5000),
  exportLimit: Number(process.env.ANALYTICS_EXPORT_LIMIT ?? 20000)
} as const;

export type AnalyticsSchema = typeof analyticsSchema;
