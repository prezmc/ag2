-- AG2 schema — runs once when the TimescaleDB volume is first created.
-- instrumentation.ts also applies the idempotent parts on every boot.

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS measurements (
    time                TIMESTAMPTZ NOT NULL,
    device_id           TEXT NOT NULL,
    rco2                DOUBLE PRECISION,
    pm01                DOUBLE PRECISION,
    pm02                DOUBLE PRECISION,
    pm02_compensated    DOUBLE PRECISION,
    pm10                DOUBLE PRECISION,
    pm003_count         DOUBLE PRECISION,
    atmp                DOUBLE PRECISION,
    atmp_compensated    DOUBLE PRECISION,
    rhum                DOUBLE PRECISION,
    rhum_compensated    DOUBLE PRECISION,
    tvoc_index          DOUBLE PRECISION,
    tvoc_raw            DOUBLE PRECISION,
    nox_index           DOUBLE PRECISION,
    nox_raw             DOUBLE PRECISION,
    wifi                DOUBLE PRECISION,
    boot_count          INTEGER
);

SELECT create_hypertable('measurements', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_measurements_device_time
    ON measurements (device_id, time DESC);

-- Keep 1 year of raw data
SELECT add_retention_policy('measurements', INTERVAL '1 year', if_not_exists => TRUE);

-- Latest reading + health per device (written by the poller every poll)
CREATE TABLE IF NOT EXISTS device_status (
    device_id             TEXT PRIMARY KEY,
    last_seen             TIMESTAMPTZ,
    last_attempt          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error            TEXT,
    consecutive_failures  INTEGER NOT NULL DEFAULT 0,
    payload               JSONB
);

-- ── 1-hour rollups (7D / 30D charts) ─────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS measurements_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time)     AS bucket,
    device_id,
    AVG(rco2)                       AS rco2,
    AVG(pm01)                       AS pm01,
    AVG(pm02)                       AS pm02,
    AVG(pm02_compensated)           AS pm02_compensated,
    AVG(pm10)                       AS pm10,
    AVG(pm003_count)                AS pm003_count,
    AVG(atmp)                       AS atmp,
    AVG(atmp_compensated)           AS atmp_compensated,
    AVG(rhum)                       AS rhum,
    AVG(rhum_compensated)           AS rhum_compensated,
    AVG(tvoc_index)                 AS tvoc_index,
    AVG(nox_index)                  AS nox_index,
    AVG(wifi)                       AS wifi
FROM measurements
GROUP BY 1, 2
WITH NO DATA;

SELECT add_continuous_aggregate_policy('measurements_hourly',
    start_offset      => INTERVAL '3 hours',
    end_offset        => INTERVAL '1 hour',
    schedule_interval => INTERVAL '30 minutes',
    if_not_exists     => TRUE);

SELECT add_retention_policy('measurements_hourly', INTERVAL '2 years', if_not_exists => TRUE);

-- ── 1-day rollups (1Y / All charts) ──────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS measurements_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time)      AS bucket,
    device_id,
    AVG(rco2)                       AS rco2,
    AVG(pm01)                       AS pm01,
    AVG(pm02)                       AS pm02,
    AVG(pm02_compensated)           AS pm02_compensated,
    AVG(pm10)                       AS pm10,
    AVG(pm003_count)                AS pm003_count,
    AVG(atmp)                       AS atmp,
    AVG(atmp_compensated)           AS atmp_compensated,
    AVG(rhum)                       AS rhum,
    AVG(rhum_compensated)           AS rhum_compensated,
    AVG(tvoc_index)                 AS tvoc_index,
    AVG(nox_index)                  AS nox_index,
    AVG(wifi)                       AS wifi
FROM measurements
GROUP BY 1, 2
WITH NO DATA;

SELECT add_continuous_aggregate_policy('measurements_daily',
    start_offset      => INTERVAL '3 days',
    end_offset        => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists     => TRUE);

SELECT add_retention_policy('measurements_daily', INTERVAL '10 years', if_not_exists => TRUE);
