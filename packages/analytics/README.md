# AI Video Analytics (dbt)

dbt project that transforms raw application data (Postgres/CDC + Kafka) into
analytics marts for the AI video platform.

## Structure

- `models/staging/` — cleaned views over `raw` sources.
- `models/marts/` — dimension and fact tables plus metric marts.
- `macros/` — reusable SQL macros (`safe_divide`, `day_bucket`, `is_task_success`).
- `tests/` — singular data quality tests.
- `analyses/` — ad-hoc compiled SQL.

## Metrics
- **Cost per task** — `mart_cost_per_task.cost_per_task`

- **Success rate** — `mart_task_metrics.success_rate`
- **Average duration** — `mart_task_metrics.avg_duration_seconds`
- **Credits consumed** — `mart_credit_metrics.credits_consumed`
- **DAU** — `mart_dau.dau` / `mart_user_metrics.dau`

## Setup

1. Install dbt with the ClickHouse adapter (not included here).
2. Copy `profiles.yml.example` to `~/.dbt/profiles.yml` (or set `DBT_PROFILES_DIR`).
3. Ensure the data stack is running:

   ```bash
   docker compose -f infra/docker-compose.data.yml up -d
   ```

4. Run dbt:

   ```bash
   cd packages/analytics
   dbt debug
   dbt run
   dbt test
   dbt docs generate && dbt docs serve
   ```

## Metabase

Metabase is provided in `infra/docker-compose.data.yml` and connects to ClickHouse.
Import the queries in `infra/metabase/sample_dashboard.sql` as native SQL questions.