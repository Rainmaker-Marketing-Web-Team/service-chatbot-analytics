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

export type AnalyticsInsightItem = {
  label: string;
  count: number;
};

export type AnalyticsDashboardResponse = {
  summary: AnalyticsSummary;
  timeline: TimelinePoint[];
  sourceBreakdown: SourceBreakdownPoint[];
  topQuestions: AnalyticsInsightItem[];
  busiestTimes: AnalyticsInsightItem[];
  filterOptions: FilterOptions;
  meta: {
    generatedAt: string;
  };
};
