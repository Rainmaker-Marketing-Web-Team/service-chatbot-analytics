import { memo } from "react";
import type { AnalyticsSummary } from "@/app/lib/analytics/types";
import { formatCompactNumber, formatPercent } from "@/app/lib/utils/format";

type SummaryCardsProps = {
  summary: AnalyticsSummary;
};

function SummaryCardsComponent({ summary }: SummaryCardsProps) {
  const cards = [
    {
      label: "Total messages",
      value: formatCompactNumber(summary.totalRecords),
      note: "All chat messages in the connected dataset"
    },
    {
      label: "Filtered messages",
      value: formatCompactNumber(summary.filteredRecords),
      note: `${formatPercent(summary.filterCoverage)} of total messages`
    },
    {
      label: "Active projects",
      value: formatCompactNumber(summary.uniqueClients),
      note: "Projects represented in the filtered slice"
    },
    {
      label: "Active channels",
      value: formatCompactNumber(summary.uniqueCampaigns),
      note: "Distinct chat channels in the filtered slice"
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

export const SummaryCards = memo(SummaryCardsComponent);
