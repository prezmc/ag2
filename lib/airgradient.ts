/**
 * Server-side client for the AirGradient local server API.
 * Docs: https://github.com/airgradienthq/arduino/blob/master/docs/local-server.md
 *
 * Used by both the background poller and the /api/proxy live-read route,
 * so all the hardening (address policy, timeout, no redirects, JSON-only)
 * lives in one place.
 */
import type { AirGradientMeasures } from './types';
import { validateDeviceAddress, serverAddressOptions } from './addressValidation';

export class DeviceFetchError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'DeviceFetchError';
  }
}

const NUMERIC_FIELDS = [
  'wifi', 'rco2',
  'pm01', 'pm02', 'pm10', 'pm02Compensated',
  'pm01Standard', 'pm02Standard', 'pm10Standard',
  'pm003Count', 'pm005Count', 'pm01Count', 'pm02Count', 'pm50Count', 'pm10Count',
  'atmp', 'atmpCompensated', 'rhum', 'rhumCompensated',
  'tvocIndex', 'tvocRaw', 'noxIndex', 'noxRaw',
  'boot', 'bootCount',
] as const;

const STRING_FIELDS = ['serialno', 'model', 'firmware', 'ledMode'] as const;

/**
 * Keep only known fields with the right types. The device is on the LAN and
 * trusted-ish, but this guarantees what we store and render is well-formed.
 */
export function sanitizeMeasures(raw: unknown): AirGradientMeasures {
  if (typeof raw !== 'object' || raw === null) {
    throw new DeviceFetchError('Device returned an unexpected payload', 502);
  }
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of NUMERIC_FIELDS) {
    const v = src[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  for (const k of STRING_FIELDS) {
    const v = src[k];
    if (typeof v === 'string') out[k] = v.slice(0, 64);
  }
  return out as AirGradientMeasures;
}

/** Fetch and sanitize /measures/current from a device. Throws DeviceFetchError. */
export async function fetchDeviceMeasures(
  address: string,
  timeoutMs = 10_000,
): Promise<AirGradientMeasures> {
  const check = validateDeviceAddress(address, serverAddressOptions());
  if (!check.valid || !check.normalized) {
    throw new DeviceFetchError(check.error ?? 'Invalid device address', 400);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${check.normalized}/measures/current`, {
      headers: { Accept: 'application/json', 'User-Agent': 'AG2/1.0' },
      signal: controller.signal,
      redirect: 'manual',
      cache: 'no-store',
    });

    if (res.status >= 300 && res.status < 400) {
      throw new DeviceFetchError('Device responded with a redirect, which is not allowed', 502);
    }
    if (!res.ok) {
      throw new DeviceFetchError(`Device responded with HTTP ${res.status}`, 502);
    }
    const ct = res.headers.get('content-type')?.toLowerCase() ?? '';
    if (!ct.includes('application/json')) {
      throw new DeviceFetchError('Device did not return JSON — is this an AirGradient monitor?', 502);
    }

    return sanitizeMeasures(await res.json());
  } catch (err) {
    if (err instanceof DeviceFetchError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new DeviceFetchError('Timed out — device may be offline or unreachable', 504);
    }
    const cause = (err as { cause?: { code?: string } })?.cause?.code;
    if (cause === 'ECONNREFUSED') throw new DeviceFetchError('Connection refused by device', 502);
    if (cause === 'EHOSTUNREACH' || cause === 'ENETUNREACH') {
      throw new DeviceFetchError('Device is unreachable from the server', 504);
    }
    throw new DeviceFetchError('Failed to reach device', 502);
  } finally {
    clearTimeout(timer);
  }
}
