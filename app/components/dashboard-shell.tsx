"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { AnalyticsCharts } from "@/app/components/analytics-charts";
import { DataTable } from "@/app/components/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/app/components/feedback-states";
import { FilterBar } from "@/app/components/filter-bar";
import { InsightCards } from "@/app/components/insight-cards";
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

function areFiltersEqual(left: AnalyticsFilters, right: AnalyticsFilters) {
  return (
    left.startDate === right.startDate &&
    left.endDate === right.endDate &&
    left.client === right.client &&
    left.campaign === right.campaign &&
    left.source === right.source &&
    left.search === right.search
  );
}

export function DashboardShell() {
  const [draftFilters, setDraftFilters] = useState<AnalyticsFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFilters>(initialFilters);
  const [showRows, setShowRows] = useState(false);
  const [data, setData] = useState<AnalyticsDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(
    async (nextFilters: AnalyticsFilters, includeRows: boolean, signal?: AbortSignal) => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams(toQueryString(nextFilters));

        if (includeRows) {
          params.set("includeRows", "1");
        }

        const response = await fetch(`/api/analytics?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Dashboard request failed.");
        }

        const payload = (await response.json()) as AnalyticsDashboardResponse;
        startTransition(() => {
          setData(payload);
        });
      } catch (requestError) {
        if (signal?.aborted || (requestError instanceof DOMException && requestError.name === "AbortError")) {
          return;
        }

        const message = requestError instanceof Error ? requestError.message : "Unexpected dashboard error.";
        setError(message);
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadDashboard(appliedFilters, showRows, controller.signal);

    return () => controller.abort();
  }, [appliedFilters, loadDashboard, showRows]);

  const hasPendingFilterChanges = useMemo(
    () => !areFiltersEqual(draftFilters, appliedFilters),
    [appliedFilters, draftFilters]
  );

  const selectedWindow = useMemo(() => {
    const from = appliedFilters.startDate ? format(new Date(appliedFilters.startDate), "MMM d, yyyy") : "Any time";
    const to = appliedFilters.endDate ? format(new Date(appliedFilters.endDate), "MMM d, yyyy") : "Today";

    return `${from} to ${to}`;
  }, [appliedFilters.endDate, appliedFilters.startDate]);

  return (
    <main className="dashboard-page">
      <div className="dashboard-shell">
        <section className="surface-panel">
          <div className="header-row">
            <div>
              <div className="eyebrow">Chatbot Analytics</div>
              <h1 className="page-title">Usage overview</h1>
            </div>

            <div className="stats-inline compact-stats">
              <div className="inline-stat">
                <span>Selected window</span>
                <strong>{selectedWindow}</strong>
              </div>
              <div className="inline-stat">
                <span>Status</span>
                <strong>{isLoading && data ? "Refreshing..." : data ? formatDateTime(data.meta.generatedAt) : "Loading"}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="surface-panel">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setAppliedFilters(draftFilters);
            }}
          >
            <div className="stack-row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div className="kicker">Filters</div>
                <p className="helper-text" style={{ margin: "6px 0 0" }}>
                  Narrow the view, then apply when you&apos;re ready.
                </p>
              </div>

              <div className="filter-actions">
                <button
                  className="button-secondary"
                  onClick={() => {
                    setDraftFilters(initialFilters);
                    setAppliedFilters(initialFilters);
                  }}
                  type="button"
                >
                  Reset filters
                </button>
                <button className="button-primary" disabled={!hasPendingFilterChanges} type="submit">
                  Apply filters
                </button>
                <button className="button-ghost" onClick={() => setShowRows((current) => !current)} type="button">
                  {showRows ? "Hide recent messages" : "Show recent messages"}
                </button>
              </div>
            </div>

            <FilterBar filters={draftFilters} onChange={setDraftFilters} options={data?.filterOptions} />
          </form>
        </section>

        {isLoading && !data ? <LoadingState /> : null}
        {error ? <ErrorState message={error} onRetry={() => loadDashboard(appliedFilters, showRows)} /> : null}

        {data ? (
          <>
            <SummaryCards summary={data.summary} />

            <section className="chart-grid dashboard-main-grid">
              <div className="surface-panel chart-frame">
                <div className="stack-row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
                  <div>
                    <div className="kicker">Usage Patterns</div>
                    <h2 style={{ margin: "4px 0 0" }}>Message volume and role mix</h2>
                  </div>
                  <span className="helper-text">{formatCompactNumber(data.summary.filteredRecords)} filtered messages</span>
                </div>
                <AnalyticsCharts timeline={data.timeline} sourceBreakdown={data.sourceBreakdown} />
              </div>

              <InsightCards busiestTimes={data.busiestTimes} topQuestions={data.topQuestions} />
            </section>

            {showRows ? (
              <section className="surface-panel">
                <div className="table-header" style={{ gridTemplateColumns: "1fr auto", alignItems: "end", marginBottom: 18 }}>
                  <div>
                    <div className="kicker">Detailed Rows</div>
                    <h2 style={{ margin: "4px 0 6px" }}>Recent messages</h2>
                    <p className="helper-text" style={{ margin: 0 }}>
                      Showing the most recent {formatCompactNumber(data.rows.length)} messages for the current filters.
                    </p>
                  </div>
                  <div className="table-actions">
                    <span className="badge">{data.meta.pageSize} row preview</span>
                  </div>
                </div>

                {data.rows.length === 0 ? <EmptyState /> : <DataTable columns={data.meta.tableColumns} rows={data.rows} />}
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
