import type { AnalyticsSummary } from "@/app/lib/analytics/types";
import { formatCompactNumber, formatPercent } from "@/app/lib/utils/format";

type SummaryCardsProps = {
  summary: AnalyticsSummary;
};

export function SummaryCards({ summary }: SummaryCardsProps) {
  const cards = [
    {
      label: "Total records",
      value: formatCompactNumber(summary.totalRecords),
      note: "All rows in the configured Supabase table"
    },
    {
      label: "Filtered records",
      value: formatCompactNumber(summary.filteredRecords),
      note: `${formatPercent(summary.filterCoverage)} of total records`
    },
    {
      label: "Unique campaigns",
      value: formatCompactNumber(summary.uniqueCampaigns),
      note: "Distinct campaigns in the filtered slice"
    },
    {
      label: "Unique sources",
      value: formatCompactNumber(summary.uniqueSources),
      note: "Platforms or channels present after filtering"
    }
  ];

  return (
    <section className="summary-grid">
      {cards.map((card) => (
        <div className="summary-card" key={card.label}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <span>{card.note}</span>
        </div>
      ))}
    </section>
  );
}
