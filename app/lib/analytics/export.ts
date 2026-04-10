import { analyticsSchema } from "@/app/lib/analytics/schema";

function escapeCsvCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized = typeof value === "string" ? value : JSON.stringify(value);
  const escaped = normalized.replace(/"/g, "\"\"");

  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

export function toCsv(rows: Record<string, unknown>[]) {
  const columns = analyticsSchema.dashboardColumns;
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => escapeCsvCell(row[column])).join(","))
  ];

  return lines.join("\n");
}
