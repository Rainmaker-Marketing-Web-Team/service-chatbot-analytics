export type AnalyticsFilters = {
  startDate: string;
  endDate: string;
  client: string;
  campaign: string;
  source: string;
  search: string;
};

export type FilterOptions = {
  clients: string[];
  campaigns: string[];
  sources: string[];
};

export type AnalyticsSummary = {
  totalRecords: number;
  filteredRecords: number;
  filterCoverage: number;
  uniqueClients: number;
  uniqueCampaigns: number;
  uniqueSources: number;
};

export type TimelinePoint = {
  label: string;
  count: number;
};

export type SourceBreakdownPoint = {
  label: string;
  count: number;
};

export type AnalyticsDashboardResponse = {
  summary: AnalyticsSummary;
  timeline: TimelinePoint[];
  sourceBreakdown: SourceBreakdownPoint[];
  rows: Record<string, unknown>[];
  filterOptions: FilterOptions;
  meta: {
    generatedAt: string;
    tableName: string;
    tableColumns: string[];
    pageSize: number;
    aggregationSampleSize: number;
  };
};
