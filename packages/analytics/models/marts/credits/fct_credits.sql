{{ config(materialized='incremental', unique_key='transaction_id') }}

select
    transaction_id,
    account_id,
    transaction_type,
    amount,
    reason,
    task_id,
    balance_after,
    created_at,
    case when transaction_type = 'DEBIT' then amount else 0 end as credits_consumed,
    case when transaction_type = 'CREDIT' then amount else 0 end as credits_granted,
    case when transaction_type = 'REFUND' then amount else 0 end as credits_refunded
from {{ ref('stg_credits') }}
{% if is_incremental() %}
where created_at > (select coalesce(max(created_at), toDateTime('1970-01-01')) from {{ this }})
{% endif %}
