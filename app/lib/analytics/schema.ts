export const analyticsSchema = {
  tableName: "chat_messages + chat_sessions + projects",
  columns: {
    id: "id",
    createdAt: "created_at",
    client: "project_name",
    campaign: "channel",
    source: "role",
    search: ["content", "external_session_id"]
  },
  dashboardColumns: [
    "created_at",
    "project_name",
    "project_slug",
    "channel",
    "role",
    "external_user_id",
    "external_session_id",
    "content"
  ],
  pageSize: 50,
  aggregationSampleSize: 5000
} as const;

export type AnalyticsSchema = typeof analyticsSchema;
