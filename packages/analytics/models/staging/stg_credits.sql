{{ config(materialized='view') }}

select
    id::String as transaction_id,
    account_id::String as account_id,
    type as transaction_type,
    amount,
    reason,
    task_id::Nullable(String) as task_id,
    balance_after,
    created_at
from {{ source('raw', 'credit_transactions') }}