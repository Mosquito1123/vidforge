-- Sample Metabase dashboard queries for the AI video analytics marts.
-- Run against the ClickHouse `analytics` database (dbt output schema).

-- 1. Task success rate by day
SELECT
    metric_date,
    total_tasks,
    successful_tasks,
    failed_tasks,
    success_rate
FROM analytics.mart_task_metrics
ORDER BY metric_date;

-- 2. Average task duration by day (seconds)
SELECT
    metric_date,
    avg_duration_seconds,
    median_duration_seconds
FROM analytics.mart_task_metrics
ORDER BY metric_date;

-- 3. Credits consumed by day
SELECT
    metric_date,
    credits_consumed,
    credits_granted,
    net_credits_consumed
FROM analytics.mart_credit_metrics
ORDER BY metric_date;

-- 4. Daily active users
SELECT
    metric_date,
    dau,
    new_users
FROM analytics.mart_user_metrics
ORDER BY metric_date;

-- 5. Top models by task volume
SELECT
    model_id,
    count() AS tasks,
    countIf(is_success = 1) AS successful,
    avgIf(turnaround_seconds, is_success = 1) AS avg_duration_seconds
FROM analytics.fct_tasks
GROUP BY model_id
ORDER BY tasks DESC;