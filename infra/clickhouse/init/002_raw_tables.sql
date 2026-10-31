-- Raw tables mirroring landed Postgres/CDC and Kafka data.
CREATE TABLE IF NOT EXISTS raw.users (
    id String,
    email String,
    name Nullable(String),
    created_at DateTime,
    updated_at DateTime
) ENGINE = MergeTree()
ORDER BY id;

CREATE TABLE IF NOT EXISTS raw.tasks (
    id String,
    user_id String,
    model_id String,
    status String,
    progress UInt8,
    error Nullable(String),
    created_at DateTime,
    updated_at DateTime
) ENGINE = MergeTree()
ORDER BY id;

CREATE TABLE IF NOT EXISTS raw.credit_transactions (
    id String,
    account_id String,
    type String,
    amount Decimal(18, 4),
    reason String,
    task_id Nullable(String),
    balance_after Nullable(Decimal(18, 4)),
    created_at DateTime
) ENGINE = MergeTree()
ORDER BY id;

CREATE TABLE IF NOT EXISTS raw.events (
    event_id String,
    event_type String,
    user_id Nullable(String),
    task_id Nullable(String),
    occurred_at DateTime,
    properties String
) ENGINE = MergeTree()
ORDER BY event_id;
