/**
 * Shared types for AG2 — used by both server and client code.
 */

export type LocationType = 'indoor' | 'outdoor';

export interface Device {
  id: string;
  /** Normalized base URL, e.g. http://192.168.1.100 */
  address: string;
  name?: string;
  /** Poll interval in seconds (5–3600) */
  pollingFrequency: number;
  /** Affects temperature/humidity comfort thresholds; defaults to 'indoor' */
  locationType?: LocationType;
}

/**
 * Payload returned by an AirGradient device at GET /measures/current
 * (AirGradient local server API, firmware 3.x).
 *
 * Every field is optional: which ones appear depends on the model
 * (e.g. Open Air O-1PP has no CO₂ sensor, ONE I-9PSL has no NOx channel
 * on older firmware) and on firmware version.
 */
export interface AirGradientMeasures {
  serialno?: string;
  model?: string;
  firmware?: string;
  wifi?: number;

  rco2?: number;

  pm01?: number;
  pm02?: number;
  pm10?: number;
  pm02Compensated?: number;
  pm01Standard?: number;
  pm02Standard?: number;
  pm10Standard?: number;
  pm003Count?: number;
  pm005Count?: number;
  pm01Count?: number;
  pm02Count?: number;
  pm50Count?: number;
  pm10Count?: number;

  atmp?: number;
  atmpCompensated?: number;
  rhum?: number;
  rhumCompensated?: number;

  tvocIndex?: number;
  tvocRaw?: number;
  noxIndex?: number;
  noxRaw?: number;

  boot?: number;
  bootCount?: number;
  ledMode?: string;
}

/** Latest poll result for a device, as recorded by the server poller. */
export interface DeviceStatus {
  deviceId: string;
  /** Last successful reading, or null if the device has never responded */
  payload: AirGradientMeasures | null;
  /** ms epoch of last successful poll */
  lastSeen: number | null;
  /** ms epoch of last poll attempt (success or failure) */
  lastAttempt: number | null;
  lastError: string | null;
  consecutiveFailures: number;
  /** True if the device answered within ~3 poll intervals */
  online: boolean;
}

/** One historical point from /api/measurements (raw or bucketed). */
export interface StoredMeasurement {
  deviceId: string;
  timestamp: number;
  rco2: number | null;
  pm01: number | null;
  pm02: number | null;
  pm02Compensated: number | null;
  pm10: number | null;
  pm003Count: number | null;
  atmp: number | null;
  atmpCompensated: number | null;
  rhum: number | null;
  rhumCompensated: number | null;
  tvocIndex: number | null;
  noxIndex: number | null;
  wifi: number | null;
}

// ─── Value helpers (preferring compensated readings) ─────────────────────────

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

export function pm25Of(m: { pm02Compensated?: number | null; pm02?: number | null }): number | null {
  return num(m.pm02Compensated) ?? num(m.pm02);
}

export function tempCOf(m: { atmpCompensated?: number | null; atmp?: number | null }): number | null {
  return num(m.atmpCompensated) ?? num(m.atmp);
}

export function humidityOf(m: { rhumCompensated?: number | null; rhum?: number | null }): number | null {
  return num(m.rhumCompensated) ?? num(m.rhum);
}

export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}
