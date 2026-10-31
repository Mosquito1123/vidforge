{{ config(materialized='table') }}

select
    toDate(created_at) as metric_date,
    count() as total_tasks,
    countIf(is_success = 1) as successful_tasks,
    countIf(is_failed = 1) as failed_tasks,
    countIf(is_cancelled = 1) as cancelled_tasks,
    {{ safe_divide('countIf(is_success = 1)', 'count()') }} as success_rate,
    coalesce(avgIf(turnaround_seconds, is_success = 1), 0) as avg_duration_seconds,
    coalesce(medianIf(turnaround_seconds, is_success = 1), 0) as median_duration_seconds,
    min(turnaround_seconds) as min_duration_seconds,
    max(turnaround_seconds) as max_duration_seconds
from {{ ref('fct_tasks') }}
group by 1
order by 1