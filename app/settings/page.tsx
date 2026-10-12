'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getDevices, getAllStatuses } from '@/lib/client';
import { timeAgo } from '@/lib/evaluate';
import type { Device, DeviceStatus } from '@/lib/types';
import DeviceForm from '@/components/DeviceForm';
import BuildFooter from '@/components/BuildFooter';

export default function SettingsPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [statuses, setStatuses] = useState<Map<string, DeviceStatus>>(new Map());
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try { setDevices(await getDevices()); } catch { setDevices([]); }
    try {
      const s = await getAllStatuses();
      setStatuses(new Map(s.map(x => [x.deviceId, x])));
    } catch { /* optional */ }
    setNow(Date.now());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <main className="container">
      <div className="header">
        <div className="header-row">
          <div className="settings-page-title">
            <Link href="/" className="settings-back-btn" title="Back to dashboard">←</Link>
            <h1>Settings</h1>
          </div>
        </div>
      </div>

      <div className="content">
        <section className="settings-section">
          <div className="settings-section-hd">
            <h2>Monitors</h2>
            <button className="settings-add-btn" onClick={() => setShowAdd(v => !v)}>
              {showAdd ? '✕ Cancel' : '+ Add Monitor'}
            </button>
          </div>

          {showAdd && (
            <div className="add-device-section" style={{ marginBottom: '1.5rem' }}>
              <DeviceForm onSaved={() => { setShowAdd(false); load(); }} onCancel={() => setShowAdd(false)} />
            </div>
          )}

          {devices.length === 0 ? (
            <p className="settings-empty">No monitors yet. Click &quot;Add Monitor&quot; and enter its local IP address.</p>
          ) : (
            <div className="settings-device-list">
              {devices.map(device => {
                const st = statuses.get(device.id);
                if (editingId === device.id) {
                  return (
                    <div key={device.id} className="add-device-section">
                      <DeviceForm
                        device={device}
                        onSaved={() => { setEditingId(null); load(); }}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  );
                }
                return (
                  <div key={device.id} className="settings-device-row">
                    <div className="settings-device-info">
                      <span className="settings-device-name">
                        <span className={`conn-dot ${st?.online ? 'on' : 'off'}`} />
                        {device.name ?? 'Unnamed monitor'}
                      </span>
                      <span className="settings-device-addr">
                        {device.address.replace(/^http:\/\//, '')}
                        {st?.payload?.model && <> · {st.payload.model}</>}
                        {st?.payload?.firmware && <> · FW {st.payload.firmware}</>}
                      </span>
                      <span className="settings-device-addr">
                        {st?.online
                          ? `Last reading ${timeAgo(st.lastSeen, now)}`
                          : st?.lastError
                            ? `Offline: ${st.lastError}`
                            : 'Waiting for first reading'}
                      </span>
                    </div>
                    <div className="settings-device-meta">
                      <span className="settings-device-badge">
                        {(device.locationType ?? 'indoor') === 'indoor' ? '🏠 Indoor' : '🌳 Outdoor'}
                      </span>
                      <span className="settings-device-poll">every {device.pollingFrequency}s</span>
                      <button className="settings-edit-btn" onClick={() => setEditingId(device.id)}>Edit</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {devices.length > 0 && (
            <p className="settings-hint">Remove a monitor (and its history) from its card on the dashboard.</p>
          )}
        </section>

        <section className="settings-section">
          <h2>About the local API</h2>
          <p className="settings-section-desc">
            AG2 reads each monitor&apos;s built-in local server at <code>http://&lt;ip&gt;/measures/current</code>.
            Nothing is sent to AirGradient&apos;s cloud. Give each monitor a fixed (DHCP-reserved) IP address in
            your router so it doesn&apos;t move. Only private network addresses (10.x, 172.16–31.x, 192.168.x)
            are accepted.
          </p>
        </section>
      </div>
      <BuildFooter />
    </main>
  );
}
