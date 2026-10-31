{{ config(materialized='view') }}

select
    id::String as user_id,
    email,
    name,
    created_at,
    updated_at
from {{ source('raw', 'users') }}