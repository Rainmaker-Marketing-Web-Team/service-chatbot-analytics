# Rainmaker Internal Analytics

A production-style internal analytics dashboard for Rainmaker that reads from an existing Supabase database and presents filtered business data as summary cards, trends, and a detailed table.

## Stack

- Next.js App Router
- React + TypeScript
- Supabase server-side access via API routes
- Recharts for dashboard visualizations
- Docker-ready deployment layout for local containers and future Coolify deployment

## What This App Includes

- Secure server-side Supabase access using environment variables
- Dashboard filters for:
  - date range
  - client
  - campaign
  - source/platform
  - free-text search
- Summary cards for total and filtered metrics
- Trend and source breakdown charts
- Detailed tabular results
- CSV export for the current filtered result set
- Loading, empty, and error states
- Reusable component structure and a clear data layer
- Dockerfile and `compose.yaml`

## Project Structure

```text
app/
  api/
    analytics/route.ts       # JSON dashboard payload
    export/route.ts          # CSV export endpoint
  components/                # UI building blocks
  lib/
    analytics/
      schema.ts              # Table/column mapping for your real Supabase schema
      service.ts             # Query + aggregation layer
      filters.ts             # Request filter parsing
      export.ts              # CSV serialization
    supabase/server.ts       # Server-only Supabase client
    utils/format.ts          # Shared formatting helpers
```

## Environment Variables

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Required:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Schema mapping:

- `SUPABASE_ANALYTICS_TABLE`
- `SUPABASE_ANALYTICS_ID_COLUMN`
- `SUPABASE_ANALYTICS_CREATED_AT_COLUMN`
- `SUPABASE_ANALYTICS_CLIENT_COLUMN`
- `SUPABASE_ANALYTICS_CAMPAIGN_COLUMN`
- `SUPABASE_ANALYTICS_SOURCE_COLUMN`
- `SUPABASE_ANALYTICS_SEARCH_COLUMN_PRIMARY`
- `SUPABASE_ANALYTICS_SEARCH_COLUMN_SECONDARY`
- `SUPABASE_ANALYTICS_TABLE_COLUMNS`

Dashboard tuning:

- `ANALYTICS_DASHBOARD_PAGE_SIZE`
- `ANALYTICS_AGGREGATION_SAMPLE_SIZE`
- `ANALYTICS_EXPORT_LIMIT`

## Important Schema Assumption

The app is intentionally designed so unknown Supabase schema details are isolated in one place:

- [app/lib/analytics/schema.ts](/Users/devon/Documents/GitHub/service-chatbot-analytics/app/lib/analytics/schema.ts)

If your real table or column names differ, update the environment variables first. If needed, you can also adjust defaults in that file.

The current defaults assume a table roughly shaped like:

```sql
create table analytics_events (
  id uuid primary key,
  created_at timestamptz not null,
  client_name text,
  campaign_name text,
  source_platform text,
  message_text text,
  external_id text
);
```

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Open:

```text
http://localhost:3000
```

## Production Build

```bash
npm run build
npm run start
```

## Docker

Build and run with Docker Compose:

```bash
docker compose up --build
```

Or plain Docker:

```bash
docker build -t rainmaker-internal-analytics .
docker run --env-file .env -p 3000:3000 rainmaker-internal-analytics
```

## Coolify Notes

This repository is structured to deploy cleanly through Coolify later:

- app settings come from environment variables
- the container listens on `PORT=3000`
- the Docker image uses a standalone Next.js production build

For Coolify, you can point the service at this repo and either:

1. use the provided `Dockerfile`, or
2. use a Node deployment with `npm install && npm run build` and start command `npm run start`

## Notes For Your Real Supabase Data

- The dashboard uses server-side API routes so the service-role key is never sent to the browser.
- Filter dropdown options are sampled from recent records.
- Trend and summary calculations are based on the configured aggregation sample size.
- CSV exports respect `ANALYTICS_EXPORT_LIMIT` to prevent runaway payloads.

If you want deeper rollups later, this architecture is ready for:

- authentication and role-based access
- pagination
- saved views
- richer SQL views or RPC-based aggregations in Supabase
- client-specific dashboards
