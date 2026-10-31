{{ config(materialized='table') }}

with task_costs as (
    select
        t.task_id,
        t.created_at,
        t.model_id,
        coalesce(sum(c.credits_consumed), 0) as credits_cost
    from {{ ref('fct_tasks') }} t
    left join {{ ref('fct_credits') }} c
        on c.task_id = t.task_id
    group by 1, 2, 3
)
select
    toDate(created_at) as metric_date,
    count() as total_tasks,
    sum(credits_cost) as total_credits_consumed,
    {{ cost_per_task('sum(credits_cost)', 'count()') }} as cost_per_task,
    avg(credits_cost) as avg_cost_per_task,
    min(credits_cost) as min_cost_per_task,
    max(credits_cost) as max_cost_per_task
from task_costs
group by 1
order by 1
