-- Average duration must never be negative.
select *
from {{ ref('mart_task_metrics') }}
where avg_duration_seconds < 0