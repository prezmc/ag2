/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Applies idempotent schema touch-ups, then starts the background poller.
 *
 * The full schema (hypertable + continuous aggregates) is created by
 * scripts/init-db.sql when the database volume is first initialized.
 * These statements just make sure the tables the poller writes to exist,
 * so the app also works against a database created by an older schema.
 */
const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS device_status (
     device_id             TEXT PRIMARY KEY,
     last_seen             TIMESTAMPTZ,
     last_attempt          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     last_error            TEXT,
     consecutive_failures  INTEGER NOT NULL DEFAULT 0,
     payload               JSONB
   )`,
  `ALTER TABLE measurements ADD COLUMN IF NOT EXISTS pm02_compensated DOUBLE PRECISION`,
  `ALTER TABLE measurements ADD COLUMN IF NOT EXISTS pm003_count DOUBLE PRECISION`,
  `ALTER TABLE measurements ADD COLUMN IF NOT EXISTS boot_count INTEGER`,
];

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.AG2_DISABLE_POLLER === 'true') {
    console.log('[BOOT] Poller disabled via AG2_DISABLE_POLLER');
    return;
  }

  const { query } = await import('./lib/db');

  for (const sql of MIGRATIONS) {
    try {
      await query(sql);
    } catch (err) {
      console.warn('[MIGRATE]', err instanceof Error ? err.message.slice(0, 160) : err);
    }
  }

  const { startPoller } = await import('./lib/poller');
  await startPoller();
}
