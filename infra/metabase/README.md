# Metabase Setup

Metabase is provided in `infra/docker-compose.data.yml` and connects to ClickHouse.

## Start

```bash
docker compose -f infra/docker-compose.data.yml up -d metabase clickhouse
```

Metabase UI: http://localhost:3001

## Connect to ClickHouse

1. Open Metabase and complete the initial setup wizard.
2. Add a database:
   - Type: ClickHouse
   - Host: `clickhouse`
   - Port: `8123`
   - Database name: `analytics`
   - Username: `default`
   - Password: (empty by default)
3. Save and verify the connection.

## Dashboards

- Import or paste the native SQL questions from `infra/metabase/sample_dashboard.sql`.
- A sample dashboard definition is available in `infra/metabase/sample_dashboard.json`.
