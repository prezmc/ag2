/**
 * GET /api/health — unauthenticated liveness/readiness check.
 * Reports only counts (no addresses or names), so it's safe to expose.
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { readDevices } from '@/lib/deviceStore';
import { getStatuses } from '@/lib/status';

export const dynamic = 'force-dynamic';

export async function GET() {
  let database: 'ok' | 'error' = 'ok';
  let devices = 0;
  let online = 0;
  let devicesFile: 'ok' | 'error' = 'ok';

  try {
    await query('SELECT 1');
  } catch {
    database = 'error';
  }

  try {
    const list = await readDevices();
    devices = list.length;
    if (database === 'ok') {
      online = (await getStatuses(list)).filter(s => s.online).length;
    }
  } catch {
    devicesFile = 'error';
  }

  const healthy = database === 'ok' && devicesFile === 'ok';
  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      database,
      devicesFile,
      devices,
      devicesOnline: online,
      version: process.env.NEXT_PUBLIC_BUILD_VERSION ?? 'dev',
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
