# Service Chatbot Analytics

This repository now provisions a Grafana dashboard for your Supabase Postgres chatbot data.

It boots with:

- a preconfigured PostgreSQL datasource derived from `DATABASE_URL`
- a starter dashboard for message volume, sessions, active projects, active channels, role mix, repeated user prompts, and busiest times
- dashboard variables for project, channel, role, and time range

## Stack

- Grafana
- PostgreSQL datasource provisioning
- Docker / Docker Compose

## Environment Variables

Required:

- `DATABASE_URL`

Optional:

- `GRAFANA_ADMIN_USER`
- `GRAFANA_ADMIN_PASSWORD`

If you do not set Grafana admin credentials, the compose setup defaults to `admin` / `admin`.

## Local Run

1. Copy the example env file:

```bash
cp .env.example .env
```

2. Start Grafana:

```bash
docker compose up --build
```

3. Open:

```text
http://localhost:3000
```

## What Gets Provisioned

- Datasource config is generated at container startup from `DATABASE_URL` in [entrypoint.sh](/Users/devon/Documents/GitHub/service-chatbot-analytics/grafana/entrypoint.sh)
- Dashboard provisioning is defined in [service-chatbot-analytics.yaml](/Users/devon/Documents/GitHub/service-chatbot-analytics/grafana/provisioning/dashboards/service-chatbot-analytics.yaml)
- The starter dashboard JSON lives in [service-chatbot-analytics.json](/Users/devon/Documents/GitHub/service-chatbot-analytics/grafana/dashboards/service-chatbot-analytics.json)

## Dashboard Scope

The starter board assumes this relational shape:

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

## Coolify

This repo is ready to deploy with the root [Dockerfile](/Users/devon/Documents/GitHub/service-chatbot-analytics/Dockerfile).

The only required runtime variable is:

- `DATABASE_URL`

You can also set:

- `GRAFANA_ADMIN_USER`
- `GRAFANA_ADMIN_PASSWORD`

## Security Note

For production use, rotate exposed database credentials and set a non-default Grafana admin password.
