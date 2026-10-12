/**
 * GET /api/status            → latest reading + health for every device
 * GET /api/status?id=<uuid>  → same, for one device
 *
 * Served from device_status (written by the poller), so opening the
 * dashboard doesn't add any load on the sensors themselves.
 */
import { NextRequest, NextResponse } from 'next/server';
import { readDevices } from '@/lib/deviceStore';
import { getStatuses } from '@/lib/status';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    const devices = await readDevices();
    const selected = id ? devices.filter(d => d.id === id) : devices;
    if (id && selected.length === 0) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }
    const statuses = await getStatuses(selected);
    return NextResponse.json(id ? statuses[0] : statuses);
  } catch (err) {
    console.error('[API status]', err);
    return NextResponse.json({ error: 'Failed to load device status' }, { status: 500 });
  }
}
