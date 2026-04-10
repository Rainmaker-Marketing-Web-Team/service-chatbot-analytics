import type { AnalyticsFilters, FilterOptions } from "@/app/lib/analytics/types";

type FilterBarProps = {
  filters: AnalyticsFilters;
  onChange: (next: AnalyticsFilters) => void;
  options?: FilterOptions;
};

export function FilterBar({ filters, onChange, options }: FilterBarProps) {
  const update = (key: keyof AnalyticsFilters, value: string) => {
    onChange({
      ...filters,
      [key]: value
    });
  };

  return (
    <div className="filter-grid">
      <label>
        <span className="helper-text">Date from</span>
        <input type="date" value={filters.startDate} onChange={(event) => update("startDate", event.target.value)} />
      </label>

      <label>
        <span className="helper-text">Date to</span>
        <input type="date" value={filters.endDate} onChange={(event) => update("endDate", event.target.value)} />
      </label>

      <label>
        <span className="helper-text">Client</span>
        <select value={filters.client} onChange={(event) => update("client", event.target.value)}>
          <option value="">All clients</option>
          {options?.clients.map((client) => (
            <option key={client} value={client}>
              {client}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="helper-text">Campaign</span>
        <select value={filters.campaign} onChange={(event) => update("campaign", event.target.value)}>
          <option value="">All campaigns</option>
          {options?.campaigns.map((campaign) => (
            <option key={campaign} value={campaign}>
              {campaign}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="helper-text">Source / platform</span>
        <select value={filters.source} onChange={(event) => update("source", event.target.value)}>
          <option value="">All sources</option>
          {options?.sources.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      </label>

      <label className="wide">
        <span className="helper-text">Text search</span>
        <input
          placeholder="Search client, campaign, source, content, or identifiers"
          type="search"
          value={filters.search}
          onChange={(event) => update("search", event.target.value)}
        />
      </label>
    </div>
  );
}
