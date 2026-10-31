-- Success rate must remain within [0, 1].
select *
from {{ ref('mart_task_metrics') }}
where success_rate < 0 or success_rate > 1