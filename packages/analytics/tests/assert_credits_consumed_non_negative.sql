-- Credits consumed must never be negative.
select *
from {{ ref('mart_credit_metrics') }}
where credits_consumed < 0