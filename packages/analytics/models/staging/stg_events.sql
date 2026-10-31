{{ config(materialized='view') }}

select
    event_id::String as event_id,
    event_type,
    user_id::Nullable(String) as user_id,
    task_id::Nullable(String) as task_id,
    occurred_at,
    properties
from {{ source('raw', 'events') }}