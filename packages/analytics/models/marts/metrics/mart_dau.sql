{{ config(materialized='table') }}

select
    toDate(occurred_at) as metric_date,
    countDistinct(user_id) as dau,
    count() as event_count
from {{ ref('fct_events') }}
where user_id is not null
group by 1
order by 1