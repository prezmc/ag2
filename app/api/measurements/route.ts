/**
 * GET /api/measurements?deviceId=…&startTime=…&endTime=…&resolution=…
 *
 *   startTime / endTime  ms epoch (defaults: last 24h → now)
 *   resolution           bucket size in seconds; omit for raw rows (export)
 *
 * With a resolution, the source table is picked by range so long ranges stay
 * fast: raw (≤2 days) → hourly rollup (≤60 days) → daily rollup.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Raw export cap: ~1 year of readings at a 30 s interval, keeps one request from exhausting memory. */
const MAX_RAW_ROWS = 1_100_000;

const COLS = [
  'rco2', 'pm01', 'pm02', 'pm02_compensated', 'pm10', 'pm003_count',
  'atmp', 'atmp_compensated', 'rhum', 'rhum_compensated',
  'tvoc_index', 'nox_index', 'wifi',
] as const;

const plain = COLS.join(', ');
const averaged = COLS.map(c => `AVG(${c}) AS ${c}`).join(', ');

type Row = { time: Date; device_id: string } & Record<(typeof COLS)[number], number | null>;

const r1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);
const r0 = (v: number | null) => (v == null ? null : Math.round(v));

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const deviceId = sp.get('deviceId');
    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
    }

    const now = Date.now();
    const startMs = sp.has('startTime') ? Number(sp.get('startTime')) : now - 24 * 3600_000;
    const endMs = sp.has('endTime') ? Number(sp.get('endTime')) : now;
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
      return NextResponse.json({ error: 'Invalid startTime/endTime' }, { status: 400 });
    }
    const start = new Date(startMs);
    const end = new Date(endMs);
    const rangeDays = (endMs - startMs) / 86_400_000;

    const resParam = sp.get('resolution');
    let resolutionSec: number | null = null;
    if (resParam !== null) {
      resolutionSec = Math.round(Number(resParam));
      if (!Number.isFinite(resolutionSec) || resolutionSec < 1 || resolutionSec > 7 * 86_400) {
        return NextResponse.json({ error: 'resolution must be 1–604800 seconds' }, { status: 400 });
      }
    }

    let rows: Row[];

    if (resolutionSec === null) {
      // Raw rows (used by export)
      rows = await query<Row>(
        `SELECT time, device_id, ${plain}
         FROM measurements
         WHERE device_id = $1 AND time >= $2 AND time <= $3
         ORDER BY time ASC
         LIMIT ${MAX_RAW_ROWS}`,
        [deviceId, start, end],
      );
    } else if (rangeDays > 60) {
      rows = await query<Row>(
        `SELECT bucket AS time, device_id, ${plain}
         FROM measurements_daily
         WHERE device_id = $1 AND bucket >= $2 AND bucket <= $3
         ORDER BY bucket ASC`,
        [deviceId, start, end],
      );
    } else if (rangeDays > 2) {
      rows = resolutionSec <= 3600
        ? await query<Row>(
            `SELECT bucket AS time, device_id, ${plain}
             FROM measurements_hourly
             WHERE device_id = $1 AND bucket >= $2 AND bucket <= $3
             ORDER BY bucket ASC`,
            [deviceId, start, end],
          )
        : await query<Row>(
            `SELECT time_bucket($1::interval, bucket) + ($1::interval / 2) AS time,
                    device_id, ${averaged}
             FROM measurements_hourly
             WHERE device_id = $2 AND bucket >= $3 AND bucket <= $4
             GROUP BY 1, device_id
             ORDER BY 1 ASC`,
            [`${resolutionSec} seconds`, deviceId, start, end],
          );
    } else {
      rows = await query<Row>(
        `SELECT time_bucket($1::interval, time) + ($1::interval / 2) AS time,
                device_id, ${averaged}
         FROM measurements
         WHERE device_id = $2 AND time >= $3 AND time <= $4
         GROUP BY 1, device_id
         ORDER BY 1 ASC`,
        [`${resolutionSec} seconds`, deviceId, start, end],
      );
    }

    return NextResponse.json(
      rows.map(row => ({
        deviceId: row.device_id,
        timestamp: new Date(row.time).getTime(),
        rco2: r1(row.rco2),
        pm01: r1(row.pm01),
        pm02: r1(row.pm02),
        pm02Compensated: r1(row.pm02_compensated),
        pm10: r1(row.pm10),
        pm003Count: r0(row.pm003_count),
        atmp: r1(row.atmp),
        atmpCompensated: r1(row.atmp_compensated),
        rhum: r1(row.rhum),
        rhumCompensated: r1(row.rhum_compensated),
        tvocIndex: r0(row.tvoc_index),
        noxIndex: r0(row.nox_index),
        wifi: r1(row.wifi),
      })),
    );
  } catch (err) {
    console.error('[API measurements]', err);
    return NextResponse.json({ error: 'Failed to retrieve measurements' }, { status: 500 });
  }
}
