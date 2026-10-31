-- Daily metrics tables (targets for materialized views).
CREATE TABLE IF NOT EXISTS analytics.daily_task_metrics (
    metric_date Date,
    total_tasks UInt64,
    successful_tasks UInt64,
    failed_tasks UInt64,
    cancelled_tasks UInt64,
    success_rate Float64,
    avg_duration_seconds Float64,
    median_duration_seconds Float64
) ENGINE = MergeTree()
ORDER BY metric_date;

CREATE TABLE IF NOT EXISTS analytics.daily_credit_metrics (
    metric_date Date,
    transaction_count UInt64,
    credits_consumed Decimal(18, 4),
    credits_granted Decimal(18, 4),
    credits_refunded Decimal(18, 4),
    net_credits_consumed Decimal(18, 4),
    active_accounts UInt64
) ENGINE = MergeTree()
ORDER BY metric_date;

CREATE TABLE IF NOT EXISTS analytics.daily_event_metrics (
    metric_date Date,
    dau UInt64,
    event_count UInt64
) ENGINE = MergeTree()
ORDER BY metric_date;

CREATE TABLE IF NOT EXISTS analytics.daily_cost_per_task (
    metric_date Date,
    total_tasks UInt64,
    total_credits_consumed Decimal(18, 4),
    cost_per_task Float64
) ENGINE = MergeTree()
ORDER BY metric_date;

-- Materialized views refreshing daily metrics.
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_daily_task_metrics
TO analytics.daily_task_metrics
AS
SELECT
    toDate(created_at) AS metric_date,
    count() AS total_tasks,
    countIf(status IN ('COMPLETED', 'SUCCEEDED', 'SUCCESS')) AS successful_tasks,
    countIf(status = 'FAILED') AS failed_tasks,
    countIf(status = 'CANCELLED') AS cancelled_tasks,
    if(count() = 0, 0, countIf(status IN ('COMPLETED', 'SUCCEEDED', 'SUCCESS')) / count()) AS success_rate,
    coalesce(avgIf(dateDiff('second', created_at, coalesce(updated_at, created_at)), status IN ('COMPLETED', 'SUCCEEDED', 'SUCCESS')), 0) AS avg_duration_seconds,
    coalesce(medianIf(dateDiff('second', created_at, coalesce(updated_at, created_at)), status IN ('COMPLETED', 'SUCCEEDED', 'SUCCESS')), 0) AS median_duration_seconds
FROM raw.tasks
GROUP BY metric_date;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_daily_credit_metrics
TO analytics.daily_credit_metrics
AS
SELECT
    toDate(created_at) AS metric_date,
    count() AS transaction_count,
    sumIf(amount, type = 'DEBIT') AS credits_consumed,
    sumIf(amount, type = 'CREDIT') AS credits_granted,
    sumIf(amount, type = 'REFUND') AS credits_refunded,
    sumIf(amount, type = 'DEBIT') - sumIf(amount, type = 'REFUND') AS net_credits_consumed,
    uniqExact(account_id) AS active_accounts
FROM raw.credit_transactions
GROUP BY metric_date;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_daily_event_metrics
TO analytics.daily_event_metrics
AS
SELECT
    toDate(occurred_at) AS metric_date,
    uniqExactIf(user_id, user_id IS NOT NULL) AS dau,
    count() AS event_count
FROM raw.events
WHERE user_id IS NOT NULL
GROUP BY metric_date;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_daily_cost_per_task
TO analytics.daily_cost_per_task
AS
SELECT
    toDate(t.created_at) AS metric_date,
    count() AS total_tasks,
    sum(coalesce(c.amount, 0)) AS total_credits_consumed,
    if(count() = 0, 0, sum(coalesce(c.amount, 0)) / count()) AS cost_per_task
FROM raw.tasks AS t
LEFT JOIN raw.credit_transactions AS c
    ON c.task_id = t.id AND c.type = 'DEBIT'
GROUP BY metric_date;
