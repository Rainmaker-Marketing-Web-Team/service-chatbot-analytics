"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { AnalyticsCharts } from "@/app/components/analytics-charts";
import { DataTable } from "@/app/components/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/app/components/feedback-states";
import { FilterBar } from "@/app/components/filter-bar";
import { SummaryCards } from "@/app/components/summary-cards";
import type { AnalyticsDashboardResponse, AnalyticsFilters } from "@/app/lib/analytics/types";
import { formatCompactNumber, formatDateInputValue, formatDateTime, toQueryString } from "@/app/lib/utils/format";

const initialFilters: AnalyticsFilters = {
  startDate: formatDateInputValue(startOfDay(subDays(new Date(), 29))),
  endDate: formatDateInputValue(endOfDay(new Date())),
  client: "",
  campaign: "",
  source: "",
  search: ""
};

export function DashboardShell() {
  const [filters, setFilters] = useState<AnalyticsFilters>(initialFilters);
  const [data, setData] = useState<AnalyticsDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (nextFilters: AnalyticsFilters) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/analytics?${toQueryString(nextFilters)}`, {
        method: "GET",
        cache: "no-store"
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Dashboard request failed.");
      }

      const payload = (await response.json()) as AnalyticsDashboardResponse;
      setData(payload);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unexpected dashboard error.";
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard(filters);
  }, [filters, loadDashboard]);

  const exportHref = useMemo(() => `/api/export?${toQueryString(filters)}`, [filters]);
  const selectedWindow = useMemo(() => {
    const from = filters.startDate ? format(new Date(filters.startDate), "MMM d, yyyy") : "Any time";
    const to = filters.endDate ? format(new Date(filters.endDate), "MMM d, yyyy") : "Today";

    return `${from} to ${to}`;
  }, [filters.endDate, filters.startDate]);

  return (
    <main className="dashboard-page">
      <div className="dashboard-shell">
        <section className="hero-panel">
          <div className="hero-grid">
            <div>
              <div className="eyebrow">Chatbot Analytics</div>
              <h1 className="hero-title">Operational visibility across projects, sessions, and messages.</h1>
              <p className="hero-copy">
                Filter message activity by date, project, channel, role, and free-text terms, then explore the dataset
                through summary cards, trends, and detailed rows. The dashboard reads your database server-side so
                credentials stay off the client.
              </p>
            </div>
            <div className="stats-inline">
              <div className="inline-stat">
                <span>Selected window</span>
                <strong>{selectedWindow}</strong>
              </div>
              <div className="inline-stat">
                <span>Last refreshed</span>
                <strong>{data ? formatDateTime(data.meta.generatedAt) : "Waiting"}</strong>
              </div>
              <div className="inline-stat">
                <span>Schema target</span>
                <strong className="code-label">{data?.meta.tableName ?? "chat_messages + chat_sessions + projects"}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="surface-panel">
          <div className="stack-row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div className="kicker">Filters</div>
              <p className="helper-text" style={{ margin: "6px 0 0" }}>
                This view is configured around message rows enriched with related session and project fields.
              </p>
            </div>
            <div className="filter-actions">
              <button className="button-secondary" onClick={() => setFilters(initialFilters)} type="button">
                Reset filters
              </button>
              <a className="button-primary" href={exportHref}>
                Export filtered CSV
              </a>
            </div>
          </div>
          <FilterBar filters={filters} onChange={setFilters} options={data?.filterOptions} />
        </section>

        {isLoading ? <LoadingState /> : null}
        {error ? <ErrorState message={error} onRetry={() => loadDashboard(filters)} /> : null}

        {!isLoading && !error && data ? (
          <>
            <SummaryCards summary={data.summary} />

            <section className="chart-grid">
              <div className="surface-panel chart-frame">
                <div className="stack-row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
                  <div>
                    <div className="kicker">Trend View</div>
                    <h2 style={{ margin: "4px 0 0" }}>Message volume over time</h2>
                  </div>
                  <span className="helper-text">{formatCompactNumber(data.summary.filteredRecords)} filtered messages</span>
                </div>
                <AnalyticsCharts timeline={data.timeline} sourceBreakdown={data.sourceBreakdown} />
              </div>

              <div className="surface-panel chart-frame">
                <div className="kicker">Context</div>
                <h2 style={{ margin: "4px 0 14px" }}>Filter impact</h2>
                <div className="summary-grid" style={{ gridTemplateColumns: "1fr", marginBottom: 16 }}>
                  <div className="summary-card">
                    <span>Total messages</span>
                    <strong>{formatCompactNumber(data.summary.totalRecords)}</strong>
                    <span>Across the connected chat dataset</span>
                  </div>
                  <div className="summary-card">
                    <span>Filtered messages</span>
                    <strong>{formatCompactNumber(data.summary.filteredRecords)}</strong>
                    <span>Matching the current filters and search query</span>
                  </div>
                  <div className="summary-card">
                    <span>Unique projects</span>
                    <strong>{formatCompactNumber(data.summary.uniqueClients)}</strong>
                    <span>Within the filtered result set</span>
                  </div>
                </div>
                <div className="notice">
                  <span className="code-label">DATABASE_URL</span> now takes priority and queries your joined chat schema
                  directly. The older Supabase table mapping remains available as a fallback.
                </div>
              </div>
            </section>

            <section className="surface-panel">
              <div className="table-header" style={{ gridTemplateColumns: "1fr auto", alignItems: "end", marginBottom: 18 }}>
                <div>
                  <div className="kicker">Detailed Rows</div>
                  <h2 style={{ margin: "4px 0 6px" }}>Filtered dataset preview</h2>
                  <p className="helper-text" style={{ margin: 0 }}>
                    Showing the most recent {formatCompactNumber(data.rows.length)} messages with live server-side filters.
                  </p>
                </div>
                <div className="table-actions">
                  <span className="badge">{data.meta.pageSize} row page size</span>
                </div>
              </div>
              {data.rows.length === 0 ? <EmptyState /> : <DataTable columns={data.meta.tableColumns} rows={data.rows} />}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
