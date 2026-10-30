/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Waits for the database, creates/updates the schema, then starts the poller.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // Run in the background: Next.js holds all requests until register() returns,
  // so awaiting the database here would freeze the dashboard while the db starts.
  void boot().catch(err => console.error('[BOOT] Failed:', err));
}

async function boot() {
  const { query } = await import('./lib/db');
  const { SCHEMA } = await import('./lib/schema');

  // The database container may still be starting (or restarting) — keep
  // trying until it answers; the dashboard stays up and reports it meanwhile.
  for (let attempt = 1; ; attempt++) {
    try {
      await query('SELECT 1');
      if (attempt > 1) console.log('[BOOT] Database is up');
      break;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === '28P01' && (attempt === 1 || attempt % 20 === 0)) {
        // Wrong password: the database was created with a different DB_PASSWORD
        console.error(
          '[BOOT] The database rejected the password. DB_PASSWORD in your .env does not match ' +
          'the password the database was created with. Put the original value back, or see ' +
          '"Changing the database password" in INSTALL.md.',
        );
      } else if (attempt === 1 || attempt % 10 === 0) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`[BOOT] Waiting for the database… (${msg.slice(0, 80)})`);
      }
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  let failures = 0;
  for (const step of SCHEMA) {
    try {
      await query(step.sql);
    } catch (err) {
      failures++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[SCHEMA] ${step.name}: ${msg.slice(0, 160)}`);
    }
  }
  console.log(failures ? `[SCHEMA] Done with ${failures} warning(s)` : '[SCHEMA] Ready');

  if (process.env.AG2_DISABLE_POLLER === 'true') {
    console.log('[BOOT] Poller disabled via AG2_DISABLE_POLLER');
    return;
  }
  const { startPoller } = await import('./lib/poller');
  await startPoller();
}
