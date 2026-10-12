/**
 * Server-side background poller.
 *
 * Polls every configured AirGradient device on its own interval, writes each
 * reading to TimescaleDB, and records the latest payload + health in
 * device_status. Runs from instrumentation.ts on server boot, independent of
 * any open browser tab.
 *
 * State lives on globalThis so API routes (which Next.js may bundle as
 * separate module instances) can call syncDevices() and talk to the same
 * timers — adding or editing a device takes effect immediately.
 */
import { query } from './db';
import { readDevices } from './deviceStore';
import { fetchDeviceMeasures } from './airgradient';
import type { Device, AirGradientMeasures } from './types';

interface Scheduled {
  timer: ReturnType<typeof setInterval>;
  signature: string;
  inFlight: boolean;
}

interface PollerState {
  started: boolean;
  scheduled: Map<string, Scheduled>;
  resyncTimer: ReturnType<typeof setInterval> | null;
}

const g = globalThis as typeof globalThis & { __ag2Poller?: PollerState };
const state: PollerState = (g.__ag2Poller ??= {
  started: false,
  scheduled: new Map(),
  resyncTimer: null,
});

const label = (d: Device) => d.name ?? d.address;
const signatureOf = (d: Device) => `${d.address}|${d.pollingFrequency}`;

// ─── Persistence ─────────────────────────────────────────────────────────────

async function storeMeasurement(deviceId: string, m: AirGradientMeasures): Promise<void> {
  await query(
    `INSERT INTO measurements (
       time, device_id, rco2, pm01, pm02, pm02_compensated, pm10, pm003_count,
       atmp, atmp_compensated, rhum, rhum_compensated,
       tvoc_index, tvoc_raw, nox_index, nox_raw, wifi, boot_count
     ) VALUES (
       NOW(), $1, $2, $3, $4, $5, $6, $7,
       $8, $9, $10, $11,
       $12, $13, $14, $15, $16, $17
     )`,
    [
      deviceId,
      m.rco2 ?? null, m.pm01 ?? null, m.pm02 ?? null, m.pm02Compensated ?? null,
      m.pm10 ?? null, m.pm003Count ?? null,
      m.atmp ?? null, m.atmpCompensated ?? null, m.rhum ?? null, m.rhumCompensated ?? null,
      m.tvocIndex ?? null, m.tvocRaw ?? null, m.noxIndex ?? null, m.noxRaw ?? null,
      m.wifi ?? null, m.bootCount ?? m.boot ?? null,
    ],
  );
}

async function recordSuccess(deviceId: string, m: AirGradientMeasures): Promise<void> {
  await query(
    `INSERT INTO device_status (device_id, last_seen, last_attempt, last_error, consecutive_failures, payload)
     VALUES ($1, NOW(), NOW(), NULL, 0, $2)
     ON CONFLICT (device_id) DO UPDATE SET
       last_seen = NOW(), last_attempt = NOW(), last_error = NULL,
       consecutive_failures = 0, payload = EXCLUDED.payload`,
    [deviceId, JSON.stringify(m)],
  );
}

async function recordFailure(deviceId: string, message: string): Promise<void> {
  await query(
    `INSERT INTO device_status (device_id, last_attempt, last_error, consecutive_failures)
     VALUES ($1, NOW(), $2, 1)
     ON CONFLICT (device_id) DO UPDATE SET
       last_attempt = NOW(), last_error = EXCLUDED.last_error,
       consecutive_failures = device_status.consecutive_failures + 1`,
    [deviceId, message.slice(0, 300)],
  );
}

// ─── Polling ─────────────────────────────────────────────────────────────────

async function pollDevice(device: Device): Promise<void> {
  const entry = state.scheduled.get(device.id);
  if (entry?.inFlight) return; // previous poll still running (slow device)
  if (entry) entry.inFlight = true;

  try {
    const m = await fetchDeviceMeasures(device.address);
    await storeMeasurement(device.id, m);
    await recordSuccess(device.id, m);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[POLLER] ${label(device)}: ${msg}`);
    try {
      await recordFailure(device.id, msg);
    } catch (dbErr) {
      console.error('[POLLER] Could not record failure:', dbErr);
    }
  } finally {
    if (entry) entry.inFlight = false;
  }
}

function schedule(device: Device): void {
  unschedule(device.id);
  const intervalMs = Math.max(5, device.pollingFrequency) * 1000;
  const entry: Scheduled = {
    timer: setInterval(() => void pollDevice(device), intervalMs),
    signature: signatureOf(device),
    inFlight: false,
  };
  state.scheduled.set(device.id, entry);
  console.log(`[POLLER] Polling "${label(device)}" every ${device.pollingFrequency}s`);
  void pollDevice(device);
}

function unschedule(deviceId: string): void {
  const existing = state.scheduled.get(deviceId);
  if (existing) {
    clearInterval(existing.timer);
    state.scheduled.delete(deviceId);
  }
}

/**
 * Reconcile timers with devices.json: start new devices, restart changed
 * ones (address / interval), stop removed ones. Safe to call any time.
 */
export async function syncDevices(): Promise<void> {
  let devices: Device[];
  try {
    devices = await readDevices();
  } catch {
    return; // keep current schedule if the file is temporarily unreadable
  }

  const ids = new Set(devices.map(d => d.id));
  for (const id of Array.from(state.scheduled.keys())) {
    if (!ids.has(id)) {
      unschedule(id);
      console.log(`[POLLER] Stopped polling removed device ${id}`);
    }
  }
  for (const device of devices) {
    const existing = state.scheduled.get(device.id);
    if (!existing || existing.signature !== signatureOf(device)) schedule(device);
  }
}

export async function startPoller(): Promise<void> {
  if (state.started) return;
  state.started = true;
  console.log('[POLLER] Starting AirGradient poller');
  await syncDevices();
  // Safety net in case devices.json is edited by hand
  state.resyncTimer = setInterval(() => void syncDevices(), 60_000);
}
