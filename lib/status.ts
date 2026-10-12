/**
 * Server-side helpers for reading device_status (latest reading + health).
 */
import { query } from './db';
import type { Device, DeviceStatus, AirGradientMeasures } from './types';

interface StatusRow {
  device_id: string;
  last_seen: Date | null;
  last_attempt: Date | null;
  last_error: string | null;
  consecutive_failures: number;
  payload: AirGradientMeasures | null;
}

/** A device counts as online if it answered within 3 poll intervals (min 90s). */
export function isOnline(lastSeenMs: number | null, pollingFrequency: number): boolean {
  if (lastSeenMs == null) return false;
  const window = Math.max(90_000, pollingFrequency * 3 * 1000);
  return Date.now() - lastSeenMs <= window;
}

function toStatus(device: Device, row: StatusRow | undefined): DeviceStatus {
  const lastSeen = row?.last_seen ? new Date(row.last_seen).getTime() : null;
  return {
    deviceId: device.id,
    payload: row?.payload ?? null,
    lastSeen,
    lastAttempt: row?.last_attempt ? new Date(row.last_attempt).getTime() : null,
    lastError: row?.last_error ?? null,
    consecutiveFailures: row?.consecutive_failures ?? 0,
    online: isOnline(lastSeen, device.pollingFrequency),
  };
}

export async function getStatuses(devices: Device[]): Promise<DeviceStatus[]> {
  if (devices.length === 0) return [];
  const rows = await query<StatusRow>(
    `SELECT device_id, last_seen, last_attempt, last_error, consecutive_failures, payload
     FROM device_status WHERE device_id = ANY($1)`,
    [devices.map(d => d.id)],
  );
  const byId = new Map(rows.map(r => [r.device_id, r]));
  return devices.map(d => toStatus(d, byId.get(d.id)));
}
