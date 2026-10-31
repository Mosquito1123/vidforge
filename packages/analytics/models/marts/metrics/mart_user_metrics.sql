{{ config(materialized='table') }}

with daily_new_users as (
    select
        toDate(registered_at) as metric_date,
        count() as new_users
    from {{ ref('dim_users') }}
    group by 1
)
select
    d.metric_date,
    d.dau,
    d.event_count,
    coalesce(n.new_users, 0) as new_users
from {{ ref('mart_dau') }} d
left join daily_new_users n on n.metric_date = d.metric_date
order by 1