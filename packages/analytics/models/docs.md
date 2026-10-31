{% docs table_stg_users %}
Staging view of application users landed from Postgres.
{% enddocs %}

{% docs table_fct_tasks %}
Task fact table with status flags and turnaround duration.
{% enddocs %}

{% docs metric_success_rate %}
Share of tasks that completed successfully.
{% enddocs %}

{% docs metric_avg_duration %}
Average turnaround duration in seconds for successful tasks.
{% enddocs %}

{% docs metric_credits_consumed %}
Total credits spent by users, net of refunds.
{% enddocs %}

{% docs metric_dau %}
Number of distinct users with at least one product event in a day.
{% enddocs %}

{% docs metric_cost_per_task %}
Average credits consumed per task.
{% enddocs %}
