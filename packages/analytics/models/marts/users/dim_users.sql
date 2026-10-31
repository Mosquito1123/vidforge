{{ config(materialized='table') }}

select
    u.user_id,
    u.email,
    u.name,
    u.created_at as registered_at,
    u.updated_at,
    count(distinct t.task_id) as total_tasks,
    coalesce(sum(t.is_success), 0) as completed_tasks,
    coalesce(sum(t.is_failed), 0) as failed_tasks,
    {{ safe_divide('coalesce(sum(t.is_success), 0)', 'count(distinct t.task_id)') }} as task_success_rate,
    coalesce(avgIf(t.turnaround_seconds, t.is_success = 1), 0) as avg_task_duration_seconds,
    coalesce(sum(case when t.is_success = 1 then t.turnaround_seconds else 0 end), 0) as total_task_duration_seconds
from {{ ref('stg_users') }} u
left join {{ ref('fct_tasks') }} t on t.user_id = u.user_id
group by 1, 2, 3, 4, 5