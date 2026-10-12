import { getMeasurements } from './client';
import type { StoredMeasurement } from './types';

export type ExportFormat = 'csv' | 'json';

export async function exportDeviceData(opts: {
  deviceId: string;
  startTime?: number;
  endTime?: number;
  format: ExportFormat;
}): Promise<Blob> {
  // No resolution → raw rows
  const rows = await getMeasurements(opts.deviceId, { startTime: opts.startTime ?? 0, endTime: opts.endTime });
  return opts.format === 'json'
    ? new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
    : toCSV(rows);
}

const COLUMNS: (keyof StoredMeasurement)[] = [
  'rco2', 'pm01', 'pm02', 'pm02Compensated', 'pm10', 'pm003Count',
  'atmp', 'atmpCompensated', 'rhum', 'rhumCompensated',
  'tvocIndex', 'noxIndex', 'wifi',
];

/** Quote when needed, and neutralize spreadsheet formula injection. */
function escapeCSV(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function toCSV(rows: StoredMeasurement[]): Blob {
  const header = ['timestamp', 'datetime', 'deviceId', ...COLUMNS];
  const lines = [header.join(',')];
  for (const m of rows) {
    lines.push(
      [
        String(m.timestamp),
        new Date(m.timestamp).toISOString(),
        m.deviceId,
        ...COLUMNS.map(c => (m[c] == null ? '' : String(m[c]))),
      ].map(escapeCSV).join(','),
    );
  }
  return new Blob([lines.join('\n')], { type: 'text/csv' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function exportFilename(deviceName: string, format: ExportFormat, range: string): string {
  const slug = deviceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'device';
  const date = new Date().toISOString().split('T')[0];
  return `airgradient_${slug}_${range}_${date}.${format}`;
}
