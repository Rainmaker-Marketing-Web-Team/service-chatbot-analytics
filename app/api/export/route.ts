import { NextRequest, NextResponse } from "next/server";
import { parseFilters } from "@/app/lib/analytics/filters";
import { toCsv } from "@/app/lib/analytics/export";
import { getExportRows } from "@/app/lib/analytics/service";

export async function GET(request: NextRequest) {
  try {
    const filters = parseFilters(request.nextUrl.searchParams);
    const rows = await getExportRows(filters);
    const csv = toCsv(rows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="rainmaker-analytics-export-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected export API error.";

    return NextResponse.json(
      {
        error: message
      },
      {
        status: 500
      }
    );
  }
}
