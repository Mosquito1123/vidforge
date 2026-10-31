{{ config(materialized='view') }}

select
    id::String as task_id,
    user_id::String as user_id,
    model_id::String as model_id,
    status,
    progress,
    error,
    created_at,
    updated_at
from {{ source('raw', 'tasks') }}