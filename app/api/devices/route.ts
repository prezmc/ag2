import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { readDevices, mutateDevices } from '@/lib/deviceStore';
import { validateDeviceAddress, serverAddressOptions } from '@/lib/addressValidation';
import { syncDevices } from '@/lib/poller';
import type { Device } from '@/lib/types';

export const dynamic = 'force-dynamic';

class HttpError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

// GET - list devices
export async function GET() {
  try {
    return NextResponse.json(await readDevices());
  } catch {
    return NextResponse.json({ error: 'Failed to read devices' }, { status: 500 });
  }
}

// POST - add a device
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const addr = validateDeviceAddress(String(body.address ?? ''), serverAddressOptions());
    if (!addr.valid || !addr.normalized) {
      return NextResponse.json({ error: addr.error ?? 'Invalid address' }, { status: 400 });
    }

    const freq = Number(body.pollingFrequency ?? 30);
    if (!Number.isFinite(freq)) {
      return NextResponse.json({ error: 'pollingFrequency must be a number' }, { status: 400 });
    }

    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
    const newDevice: Device = {
      id: randomUUID(),
      address: addr.normalized,
      name: name || undefined,
      pollingFrequency: Math.max(5, Math.min(3600, Math.round(freq))),
      locationType: body.locationType === 'outdoor' ? 'outdoor' : 'indoor',
    };

    await mutateDevices(devices => {
      if (devices.some(d => d.address === newDevice.address)) {
        throw new HttpError('A device with this address already exists', 409);
      }
      return { devices: [...devices, newDevice], result: undefined };
    });

    void syncDevices(); // start polling right away
    return NextResponse.json(newDevice, { status: 201 });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[API devices] POST failed:', err);
    return NextResponse.json({ error: 'Failed to add device' }, { status: 500 });
  }
}
