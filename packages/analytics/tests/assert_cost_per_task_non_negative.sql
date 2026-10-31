-- Cost per task must never be negative.
select *
from {{ ref('mart_cost_per_task') }}
where cost_per_task < 0 or total_credits_consumed < 0
