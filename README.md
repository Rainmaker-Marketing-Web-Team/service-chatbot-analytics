# Service Chatbot Analytics

A production-style internal analytics dashboard that reads chatbot data from Supabase Postgres and presents filtered activity as summary cards, trends, and a detailed table.

## Stack

- Next.js App Router
- React + TypeScript
- Supabase Postgres access via `DATABASE_URL`
- Recharts for dashboard visualizations
- Docker-ready deployment layout for local containers and future Coolify deployment

## What This App Includes

- Secure server-side database access using environment variables
- Dashboard filters for:
  - date range
  - project
  - channel
  - role
  - free-text search
- Summary cards for total and filtered metrics
- Trend and source breakdown charts
- Detailed tabular results
- Loading, empty, and error states
- Reusable component structure and a clear data layer
- Dockerfile and `compose.yaml`

## Project Structure

```text
app/
  api/
    analytics/route.ts       # JSON dashboard payload
  components/                # UI building blocks
  lib/
    analytics/
      schema.ts              # Column aliases and dashboard defaults
      service.ts             # Query + aggregation layer
      filters.ts             # Request filter parsing
    postgres/server.ts       # Server-only Postgres client
    supabase/server.ts       # Fallback Supabase API client
    utils/format.ts          # Shared formatting helpers
```

## Environment Variables

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Required:

- `DATABASE_URL`

Optional fallback:

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

## Current Schema Assumption

The app is now tuned for a relational chat schema where each analytics row is a `chat_messages` row joined to `chat_sessions` and `projects`.

The alias/default config still lives here:

- [app/lib/analytics/schema.ts](/Users/devon/Documents/GitHub/service-chatbot-analytics/app/lib/analytics/schema.ts)

If your real table or column names differ, update the environment variables first. If needed, you can also adjust defaults in that file.

The current defaults assume a dataset roughly shaped like:

```sql
select
  cm.id,
  cm.created_at,
  p.name as project_name,
  p.slug as project_slug,
  cs.channel,
  cm.role,
  cs.external_user_id,
  cs.external_session_id,
  cm.content
from public.chat_messages cm
join public.chat_sessions cs on cs.id = cm.session_id
join public.projects p on p.id = cs.project_id;
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
- the container listens on port `3000`
- the Docker image uses a standalone Next.js production build

For Coolify, you can point the service at this repo and either:

1. use the provided `Dockerfile`, or
2. use a Node deployment with `npm install && npm run build` and start command `npm run start`

## Notes For Your Real Data

- The dashboard uses server-side API routes so the database URL is never sent to the browser.
- `DATABASE_URL` takes priority when present.
- Filter dropdown options are sampled from recent records.
- Trend and summary calculations are based on the configured aggregation sample size.

If you want deeper rollups later, this architecture is ready for:

- authentication and role-based access
- pagination
- saved views
- richer SQL views or RPC-based aggregations in Supabase
- client-specific dashboards
