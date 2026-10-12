/**
 * Server-side device registry, persisted as JSON in DATA_DIR/devices.json.
 *
 * One module replaces the three separate readers the old app had (two API
 * routes + the poller). Writes go through a temp file + rename so a crash
 * mid-write can't leave a truncated devices.json, and are serialized with a
 * simple in-process lock so concurrent requests can't clobber each other.
 */
import { promises as fs } from 'fs';
import path from 'path';
import type { Device } from './types';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');

let lock: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => undefined);
  return run;
}

function normalize(d: Device): Device {
  return {
    ...d,
    pollingFrequency: Math.max(5, Math.min(3600, Number(d.pollingFrequency) || 30)),
    locationType: d.locationType === 'outdoor' ? 'outdoor' : 'indoor',
  };
}

export async function readDevices(): Promise<Device[]> {
  try {
    const raw = await fs.readFile(DEVICES_FILE, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('devices.json is not an array');
    return (parsed as Device[]).map(normalize);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    console.error('[DEVICES] Failed to read devices.json:', err);
    throw err;
  }
}

async function writeDevices(devices: Device[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DEVICES_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(devices, null, 2), 'utf-8');
  await fs.rename(tmp, DEVICES_FILE);
}

/** Read-modify-write under the lock. */
export function mutateDevices<T>(fn: (devices: Device[]) => { devices: Device[]; result: T }): Promise<T> {
  return withLock(async () => {
    const current = await readDevices();
    const { devices, result } = fn(current);
    await writeDevices(devices);
    return result;
  });
}

export function getDataDir(): string {
  return DATA_DIR;
}
