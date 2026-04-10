import { memo } from "react";
import type { AnalyticsInsightItem } from "@/app/lib/analytics/types";
import { formatCompactNumber } from "@/app/lib/utils/format";

type InsightCardsProps = {
  busiestTimes: AnalyticsInsightItem[];
  topQuestions: AnalyticsInsightItem[];
};

type InsightListCardProps = {
  description: string;
  emptyLabel: string;
  items: AnalyticsInsightItem[];
  title: string;
};

function InsightListCard({ description, emptyLabel, items, title }: InsightListCardProps) {
  return (
    <article className="summary-card insight-card">
      <div className="kicker">Highlights</div>
      <h3 className="insight-title">{title}</h3>
      <p className="helper-text insight-copy">{description}</p>

      {items.length > 0 ? (
        <div className="insight-list">
          {items.map((item) => (
            <div className="insight-row" key={`${item.label}-${item.count}`}>
              <div className="insight-label">{item.label}</div>
              <div className="badge">{formatCompactNumber(item.count)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="muted insight-empty">{emptyLabel}</div>
      )}
    </article>
  );
}

function InsightCardsComponent({ busiestTimes, topQuestions }: InsightCardsProps) {
  return (
    <div className="insight-stack">
      <InsightListCard
        description="Repeated user messages in the current filtered view."
        emptyLabel="No repeated user prompts found for the selected filters."
        items={topQuestions}
        title="Most Frequent User Questions"
      />

      <InsightListCard
        description="UTC hour blocks with the highest message volume."
        emptyLabel="No activity found for the selected filters."
        items={busiestTimes}
        title="Busiest Chatbot Times"
      />
    </div>
  );
}

export const InsightCards = memo(InsightCardsComponent);
