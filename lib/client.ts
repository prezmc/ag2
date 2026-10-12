/**
 * Browser-side API client. Every call goes to this app's own /api routes —
 * the browser never talks to a sensor directly.
 */
import type { Device, DeviceStatus, AirGradientMeasures, StoredMeasurement, LocationType } from './types';

async function request<T>(url: string, init?: RequestInit, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
      signal: controller.signal,
      cache: 'no-store',
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error((body && typeof body.error === 'string' && body.error) || `Request failed (HTTP ${res.status})`);
    }
    return body as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('Request timed out');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Devices ─────────────────────────────────────────────────────────────────

export const getDevices = () => request<Device[]>('/api/devices');

export const addDevice = (input: {
  address: string;
  name?: string;
  pollingFrequency: number;
  locationType: LocationType;
}) => request<Device>('/api/devices', { method: 'POST', body: JSON.stringify(input) });

export const updateDevice = (id: string, updates: Partial<Omit<Device, 'id'>>) =>
  request<Device>(`/api/devices/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(updates) });

export const removeDevice = (id: string) =>
  request<{ success: boolean; warning?: string }>(`/api/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });

// ─── Readings ────────────────────────────────────────────────────────────────

/** Latest stored reading + health for every device (from the poller). */
export const getAllStatuses = () => request<DeviceStatus[]>('/api/status');

/** Latest stored reading + health for one device (from the poller). */
export const getDeviceStatus = (id: string) =>
  request<DeviceStatus>(`/api/status?id=${encodeURIComponent(id)}`);

/** Live read straight from a device (Test connection / manual refresh). */
export const fetchLive = (address: string) =>
  request<AirGradientMeasures>(`/api/proxy?address=${encodeURIComponent(address)}`);

export function getMeasurements(
  deviceId: string,
  opts: { startTime?: number; endTime?: number; resolution?: number } = {},
): Promise<StoredMeasurement[]> {
  const p = new URLSearchParams({ deviceId });
  if (opts.startTime !== undefined) p.set('startTime', String(opts.startTime));
  if (opts.endTime !== undefined) p.set('endTime', String(opts.endTime));
  if (opts.resolution !== undefined) p.set('resolution', String(opts.resolution));
  return request<StoredMeasurement[]>(`/api/measurements?${p}`, undefined, 60_000);
}
