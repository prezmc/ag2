import { NextRequest, NextResponse } from 'next/server';
import { mutateDevices } from '@/lib/deviceStore';
import { validateDeviceAddress, serverAddressOptions } from '@/lib/addressValidation';
import { syncDevices } from '@/lib/poller';
import { query } from '@/lib/db';
import type { Device } from '@/lib/types';

export const dynamic = 'force-dynamic';

class HttpError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

type Ctx = { params: Promise<{ id: string }> };

// PUT - update a device
export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const updates: Partial<Device> = {};

    if (body.address !== undefined) {
      const addr = validateDeviceAddress(String(body.address), serverAddressOptions());
      if (!addr.valid || !addr.normalized) {
        return NextResponse.json({ error: addr.error ?? 'Invalid address' }, { status: 400 });
      }
      updates.address = addr.normalized;
    }
    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
      updates.name = name || undefined;
    }
    if (body.pollingFrequency !== undefined) {
      const freq = Number(body.pollingFrequency);
      if (!Number.isFinite(freq)) {
        return NextResponse.json({ error: 'pollingFrequency must be a number' }, { status: 400 });
      }
      updates.pollingFrequency = Math.max(5, Math.min(3600, Math.round(freq)));
    }
    if (body.locationType === 'indoor' || body.locationType === 'outdoor') {
      updates.locationType = body.locationType;
    }

    const updated = await mutateDevices(devices => {
      const idx = devices.findIndex(d => d.id === id);
      if (idx === -1) throw new HttpError('Device not found', 404);
      if (updates.address && devices.some(d => d.id !== id && d.address === updates.address)) {
        throw new HttpError('A device with this address already exists', 409);
      }
      const next = [...devices];
      next[idx] = { ...next[idx], ...updates };
      return { devices: next, result: next[idx] };
    });

    void syncDevices();
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[API devices] PUT failed:', err);
    return NextResponse.json({ error: 'Failed to update device' }, { status: 500 });
  }
}

// DELETE - remove a device and all of its stored data
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;

    await mutateDevices(devices => {
      const next = devices.filter(d => d.id !== id);
      if (next.length === devices.length) throw new HttpError('Device not found', 404);
      return { devices: next, result: undefined };
    });

    void syncDevices();

    // Remove history after the poller has been told to stop
    try {
      await query('DELETE FROM device_status WHERE device_id = $1', [id]);
      await query('DELETE FROM measurements WHERE device_id = $1', [id]);
    } catch (dbErr) {
      console.error('[API devices] Device removed but history cleanup failed:', dbErr);
      return NextResponse.json({ success: true, warning: 'Device removed, but stored history could not be deleted' });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[API devices] DELETE failed:', err);
    return NextResponse.json({ error: 'Failed to remove device' }, { status: 500 });
  }
}
