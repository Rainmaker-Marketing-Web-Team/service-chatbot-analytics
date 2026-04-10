# Service Chatbot Analytics

A Next.js dashboard for chatbot analytics backed by Supabase Postgres.

The current UI is optimized around:

- summary cards
- message volume over time
- role mix
- most frequent repeated user questions
- busiest chatbot usage times

## Stack

- Next.js App Router
- React + TypeScript
- PostgreSQL via `DATABASE_URL`
- Recharts
- Docker / Docker Compose

## Environment Variables

Required:

- `DATABASE_URL`

Example:

```bash
cp .env.example .env
```

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Docker

Run with Compose:

```bash
docker compose --env-file .env up --build
```

Or build directly:

```bash
docker build -t service-chatbot-analytics .
docker run --env-file .env -p 3000:3000 service-chatbot-analytics
```

## Coolify

Use the root [Dockerfile](/Users/devon/Documents/GitHub/service-chatbot-analytics/Dockerfile) and set:

- `DATABASE_URL`

## Data Shape

The dashboard assumes analytics come from:

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
