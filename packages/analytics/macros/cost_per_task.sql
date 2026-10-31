{% macro cost_per_task(total_cost, task_count, default_value=0) %}
  {{ safe_divide(total_cost, task_count, default_value) }}
{% endmacro %}


{% macro credits_for_task(task_id_column='task_id') %}
  coalesce((
    select sum(credits_consumed)
    from {{ ref('fct_credits') }} c
    where c.task_id = {{ task_id_column }}
  ), 0)
{% endmacro %}
