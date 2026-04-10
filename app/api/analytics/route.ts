import { NextRequest, NextResponse } from "next/server";
import { parseFilters } from "@/app/lib/analytics/filters";
import { getAnalyticsDashboard } from "@/app/lib/analytics/service";

export async function GET(request: NextRequest) {
  try {
    const filters = parseFilters(request.nextUrl.searchParams);
    const payload = await getAnalyticsDashboard(filters);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected analytics API error.";

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
