"use client";

import { memo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SourceBreakdownPoint, TimelinePoint } from "@/app/lib/analytics/types";
import { formatCompactNumber } from "@/app/lib/utils/format";

type AnalyticsChartsProps = {
  timeline: TimelinePoint[];
  sourceBreakdown: SourceBreakdownPoint[];
};

const palette = ["#0b6e4f", "#2d8a66", "#69a77e", "#f4a259", "#d97d54", "#5a6f63"];

function AnalyticsChartsComponent({ timeline, sourceBreakdown }: AnalyticsChartsProps) {
  return (
    <div className="chart-grid" style={{ gridTemplateColumns: "1.4fr 0.9fr", gap: 18 }}>
      <div style={{ minHeight: 280 }}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={timeline} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(22, 29, 24, 0.08)" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#5f6d65" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} stroke="#5f6d65" tickFormatter={formatCompactNumber} tickLine={false} axisLine={false} />
            <Tooltip formatter={(value: number) => formatCompactNumber(value)} />
            <Line dataKey="count" stroke="#0b6e4f" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ minHeight: 280 }}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={sourceBreakdown} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
            <CartesianGrid stroke="rgba(22, 29, 24, 0.08)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} stroke="#5f6d65" tickFormatter={formatCompactNumber} tickLine={false} axisLine={false} />
            <YAxis dataKey="label" type="category" width={96} stroke="#5f6d65" tickLine={false} axisLine={false} />
            <Tooltip formatter={(value: number) => formatCompactNumber(value)} />
            <Bar dataKey="count" radius={[0, 10, 10, 0]}>
              {sourceBreakdown.map((entry, index) => (
                <Cell key={entry.label} fill={palette[index % palette.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export const AnalyticsCharts = memo(AnalyticsChartsComponent);
