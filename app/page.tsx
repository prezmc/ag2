'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getDevices } from '@/lib/client';
import type { Device } from '@/lib/types';
import DeviceCard from '@/components/DeviceCard';
import HomeSummary from '@/components/HomeSummary';
import BuildFooter from '@/components/BuildFooter';
import AboutModal from '@/components/AboutModal';

type LocationFilter = 'all' | 'indoor' | 'outdoor';

export default function Home() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [filter, setFilter] = useState<LocationFilter>('all');

  const loadDevices = useCallback(async () => {
    try {
      setDevices(await getDevices());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load devices');
      setDevices(prev => prev ?? []);
    }
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const list = devices ?? [];
  const hasIndoor = list.some(d => (d.locationType ?? 'indoor') === 'indoor');
  const hasOutdoor = list.some(d => d.locationType === 'outdoor');
  const visible = list.filter(d => filter === 'all' || (d.locationType ?? 'indoor') === filter);

  return (
    <main className="container">
      <div className="header">
        <div className="header-row">
          <h1>AirGradient Local</h1>
          <div className="header-actions">
            <Link href="/settings" className="info-button" title="Settings">⚙</Link>
            <button className="info-button" onClick={() => setShowAbout(true)} title="About & data info">ℹ</button>
          </div>
        </div>
        <p className="subtitle">Live readings straight from your monitors on the local network</p>
      </div>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      <div className="content">
        {loadError && <div className="error-message">{loadError}</div>}

        <HomeSummary devices={list} />

        <section className="dashboard-section">
          <div className="section-header">
            <span className="section-title">🌿 Air Quality</span>
          </div>

          {hasIndoor && hasOutdoor && (
            <div className="location-tabs">
              {(['all', 'indoor', 'outdoor'] as LocationFilter[]).map(tab => (
                <button
                  key={tab}
                  className={`location-tab ${filter === tab ? 'active' : ''}`}
                  onClick={() => setFilter(tab)}
                >
                  {tab === 'all' && '🏠🌳 All'}
                  {tab === 'indoor' && '🏠 Indoor'}
                  {tab === 'outdoor' && '🌳 Outdoor'}
                </button>
              ))}
            </div>
          )}

          {devices !== null && list.length === 0 && (
            <div className="empty-state">
              <p>No monitors added yet.</p>
              <p>
                Go to <Link href="/settings" className="empty-state-link">Settings</Link> and add your
                AirGradient monitor by its local IP address.
              </p>
            </div>
          )}

          <div className="devices-grid">
            {visible.map(device => (
              <div key={device.id} id={`device-${device.id}`} className="device-anchor">
                <DeviceCard device={device} onChanged={loadDevices} />
              </div>
            ))}
          </div>
        </section>
      </div>
      <BuildFooter />
    </main>
  );
}
