export const analyticsSchema = {
  // Defaults are tuned for a chat analytics dataset backed by
  // chat_messages joined to chat_sessions and projects.
  tableName:
    process.env.ANALYTICS_DATA_SOURCE_NAME ??
    process.env.SUPABASE_ANALYTICS_TABLE ??
    "chat_messages + chat_sessions + projects",
  columns: {
    id: process.env.SUPABASE_ANALYTICS_ID_COLUMN ?? "id",
    createdAt: process.env.SUPABASE_ANALYTICS_CREATED_AT_COLUMN ?? "created_at",
    client: process.env.SUPABASE_ANALYTICS_CLIENT_COLUMN ?? "project_name",
    campaign: process.env.SUPABASE_ANALYTICS_CAMPAIGN_COLUMN ?? "channel",
    source: process.env.SUPABASE_ANALYTICS_SOURCE_COLUMN ?? "role",
    search: [
      process.env.SUPABASE_ANALYTICS_SEARCH_COLUMN_PRIMARY ?? "content",
      process.env.SUPABASE_ANALYTICS_SEARCH_COLUMN_SECONDARY ?? "external_session_id"
    ].filter(Boolean)
  },
  dashboardColumns: (
    process.env.SUPABASE_ANALYTICS_TABLE_COLUMNS ??
    "created_at,project_name,project_slug,channel,role,external_user_id,external_session_id,content"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  pageSize: Number(process.env.ANALYTICS_DASHBOARD_PAGE_SIZE ?? 50),
  aggregationSampleSize: Number(process.env.ANALYTICS_AGGREGATION_SAMPLE_SIZE ?? 5000)
} as const;

export type AnalyticsSchema = typeof analyticsSchema;
