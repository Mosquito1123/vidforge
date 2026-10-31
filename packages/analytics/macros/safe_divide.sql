{% macro safe_divide(numerator, denominator, default_value=0) %}
  case
    when ({{ denominator }}) = 0 then {{ default_value }}
    else ({{ numerator }}) / ({{ denominator }})
  end
{% endmacro %}


{% macro day_bucket(column) %}
  toDate({{ column }})
{% endmacro %}


{% macro is_task_success(column) %}
  {{ column }} in ('COMPLETED', 'SUCCEEDED', 'SUCCESS')
{% endmacro %}