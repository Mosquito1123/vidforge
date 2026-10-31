{{ config(materialized='table') }}

select
    toDate(created_at) as metric_date,
    count() as transaction_count,
    sum(credits_consumed) as credits_consumed,
    sum(credits_granted) as credits_granted,
    sum(credits_refunded) as credits_refunded,
    sum(credits_consumed) - sum(credits_refunded) as net_credits_consumed,
    countDistinct(account_id) as active_accounts
from {{ ref('fct_credits') }}
group by 1
order by 1