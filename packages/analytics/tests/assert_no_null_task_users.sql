-- Every task must map to a non-null user.
select *
from {{ ref('fct_tasks') }}
where user_id is null