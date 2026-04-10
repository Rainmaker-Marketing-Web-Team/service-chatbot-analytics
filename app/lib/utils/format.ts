import { format, isValid, parseISO } from "date-fns";
import type { AnalyticsFilters } from "@/app/lib/analytics/types";

export function toQueryString(filters: AnalyticsFilters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  return params.toString();
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

export function formatDateInputValue(value: Date) {
  return format(value, "yyyy-MM-dd");
}

export function formatDateTime(value: string) {
  const date = parseISO(value);
  return isValid(date) ? format(date, "MMM d, yyyy HH:mm") : value;
}

export function formatHourRange(hour: number) {
  const normalizedHour = Math.max(0, Math.min(23, hour));
  const value = String(normalizedHour).padStart(2, "0");
  return `${value}:00-${value}:59 UTC`;
}

export function formatCellValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (value instanceof Date) {
    return format(value, "MMM d, yyyy HH:mm");
  }

  if (typeof value === "number") {
    return new Intl.NumberFormat("en").format(value);
  }

  if (typeof value === "string") {
    const parsedDate = parseISO(value);
    if (isValid(parsedDate) && value.includes("-")) {
      return format(parsedDate, "MMM d, yyyy HH:mm");
    }

    return value;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return JSON.stringify(value);
}

export function formatColumnLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
