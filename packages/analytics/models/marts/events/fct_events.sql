{{ config(materialized='incremental', unique_key='event_id') }}

select
    event_id,
    event_type,
    user_id,
    task_id,
    occurred_at,
    toDate(occurred_at) as event_date,
    properties,
    case when user_id is not null then 1 else 0 end as has_user
from {{ ref('stg_events') }}
{% if is_incremental() %}
where occurred_at > (select coalesce(max(occurred_at), toDateTime('1970-01-01')) from {{ this }})
{% endif %}
