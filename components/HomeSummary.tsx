'use client';

import { useEffect, useState, useCallback } from 'react';
import { getAllStatuses } from '@/lib/client';
import { evaluate } from '@/lib/evaluate';
import { pm25Of } from '@/lib/types';
import type { Device, DeviceStatus } from '@/lib/types';

/**
 * At-a-glance strip across the top of the dashboard: one chip per monitor
 * showing its overall air-quality status and headline number, plus how many
 * monitors are online. Clicking a chip scrolls to that device's card.
 */
export default function HomeSummary({ devices }: { devices: Device[] }) {
  const [statuses, setStatuses] = useState<DeviceStatus[] | null>(null);

  const load = useCallback(async () => {
    try { setStatuses(await getAllStatuses()); } catch { setStatuses(prev => prev ?? []); /* errors also show per card */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load, devices.length]);

  // Wait for the first readings so chips are laid out once, with their real text
  if (devices.length === 0 || statuses === null) return null;

  const byId = new Map(statuses.map(s => [s.deviceId, s]));
  const online = statuses.filter(s => s.online).length;

  return (
    <div className="home-summary">
      <div className="home-summary-count">
        <span className={`conn-dot ${online === devices.length ? 'on' : online === 0 ? 'off' : 'partial'}`} />
        {online}/{devices.length} online
      </div>
      <div className="home-summary-chips">
        {devices.map(d => {
          const st = byId.get(d.id);
          const data = st?.payload;
          const ev = data ? evaluate(data, d.locationType ?? 'indoor') : null;
          const aq = ev?.airQuality;
          const headline =
            data?.rco2 != null ? `${Math.round(data.rco2)} ppm`
            : data && pm25Of(data) != null ? `${pm25Of(data)!.toFixed(1)} µg/m³`
            : '—';
          return (
            <a
              key={d.id}
              href={`#device-${d.id}`}
              className={`summary-chip${st?.online ? '' : ' offline'}`}
              style={aq ? ({ '--chip-color': aq.color, '--chip-bg': aq.bgColor } as React.CSSProperties) : undefined}
              title={aq ? `${d.name ?? d.address}: ${aq.label}` : d.name ?? d.address}
            >
              <span className="summary-chip-top">
                <span className="summary-chip-name">{d.name ?? d.address.replace(/^http:\/\//, '')}</span>
                <span className="summary-chip-value">{headline}</span>
              </span>
              <span className="summary-chip-status">{st?.online ? aq?.label ?? '…' : 'Offline'}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
