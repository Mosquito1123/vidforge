{{ config(materialized='incremental', unique_key='task_id') }}

select
    task_id,
    user_id,
    model_id,
    status,
    progress,
    error,
    created_at,
    updated_at,
    case when status in ('COMPLETED', 'SUCCEEDED', 'SUCCESS') then 1 else 0 end as is_success,
    case when status = 'FAILED' then 1 else 0 end as is_failed,
    case when status = 'CANCELLED' then 1 else 0 end as is_cancelled,
    dateDiff('second', created_at, coalesce(updated_at, created_at)) as turnaround_seconds,
    dateDiff('day', created_at, coalesce(updated_at, created_at)) as turnaround_days
from {{ ref('stg_tasks') }}
{% if is_incremental() %}
where updated_at > (select coalesce(max(updated_at), toDateTime('1970-01-01')) from {{ this }})
{% endif %}
