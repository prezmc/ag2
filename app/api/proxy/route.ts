/**
 * GET /api/proxy?address=192.168.1.100
 *
 * Live read of /measures/current straight from a device. Used for the
 * "Test connection" button when adding a device and for manual refresh.
 * Goes through the server because AirGradient devices don't send CORS headers.
 * Address policy, timeout and redirect blocking live in lib/airgradient.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchDeviceMeasures, DeviceFetchError } from '@/lib/airgradient';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');
  if (!address) {
    return NextResponse.json({ error: 'address parameter is required' }, { status: 400 });
  }

  try {
    const data = await fetchDeviceMeasures(address);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof DeviceFetchError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[API proxy]', err);
    return NextResponse.json({ error: 'Failed to fetch data from device' }, { status: 500 });
  }
}
