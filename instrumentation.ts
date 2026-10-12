/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Waits for the database, creates/updates the schema, then starts the poller.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { query } = await import('./lib/db');
  const { SCHEMA } = await import('./lib/schema');

  // The database container may still be starting — wait up to ~2 minutes.
  let ready = false;
  for (let attempt = 1; attempt <= 40; attempt++) {
    try {
      await query('SELECT 1');
      ready = true;
      break;
    } catch {
      if (attempt === 1) console.log('[BOOT] Waiting for the database…');
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (!ready) {
    console.error('[BOOT] Could not reach the database. Check DATABASE_URL / that the db container is running.');
    return;
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
