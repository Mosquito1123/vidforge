-- DAU must never be negative.
select *
from {{ ref('mart_dau') }}
where dau < 0