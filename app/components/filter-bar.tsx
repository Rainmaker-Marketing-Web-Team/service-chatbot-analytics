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
        <span className="helper-text">Project</span>
        <select value={filters.client} onChange={(event) => update("client", event.target.value)}>
          <option value="">All projects</option>
          {options?.clients.map((client) => (
            <option key={client} value={client}>
              {client}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="helper-text">Channel</span>
        <select value={filters.campaign} onChange={(event) => update("campaign", event.target.value)}>
          <option value="">All channels</option>
          {options?.campaigns.map((campaign) => (
            <option key={campaign} value={campaign}>
              {campaign}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="helper-text">Role</span>
        <select value={filters.source} onChange={(event) => update("source", event.target.value)}>
          <option value="">All roles</option>
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
          placeholder="Search project, channel, role, user, session, or message content"
          type="search"
          value={filters.search}
          onChange={(event) => update("search", event.target.value)}
        />
      </label>
    </div>
  );
}
