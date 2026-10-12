'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Download, Edit, RefreshCw, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { getDeviceStatus, fetchLive, removeDevice } from '@/lib/client';
import type { AirQualityThreshold } from '@/lib/airQualityThresholds';
import { exportDeviceData, downloadBlob, exportFilename, ExportFormat } from '@/lib/exportData';
import { pm25ToAqi } from '@/lib/aqi';
import { evaluate, timeAgo, AQ_DESCRIPTIONS, COMFORT_DESCRIPTIONS, ARC, STATUS_ARC_OFFSET } from '@/lib/evaluate';
import type { Device, DeviceStatus, AirGradientMeasures } from '@/lib/types';
import DeviceGraphs from './DeviceGraphs';
import DeviceForm from './DeviceForm';

// ── Component ────────────────────────────────────────────────────────────────

interface DeviceCardProps {
  device: Device;
  onChanged: () => void;
}

export default function DeviceCard({ device, onChanged }: DeviceCardProps) {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [live, setLive] = useState<{ data: AirGradientMeasures; at: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [showGraphs, setShowGraphs] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await getDeviceStatus(device.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }, [device.id]);

  // Poll the server's stored status (not the sensor) at the device's interval
  useEffect(() => {
    loadStatus();
    const t = setInterval(loadStatus, Math.max(5, device.pollingFrequency) * 1000);
    return () => clearInterval(t);
  }, [loadStatus, device.pollingFrequency]);

  // Keep "last seen" text fresh
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!showExport) return;
    const close = (e: MouseEvent) => {
      if (!exportRef.current?.contains(e.target as Node)) setShowExport(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showExport]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const data = await fetchLive(device.address);
      setLive({ data, at: Date.now() });
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Live read failed');
    } finally {
      setRefreshing(false);
    }
  };

  const handleRemove = async () => {
    const label = device.name || device.address;
    if (!confirm(`Remove ${label}? All stored history for this device will be deleted.`)) return;
    try {
      const res = await removeDevice(device.id);
      if (res.warning) alert(res.warning);
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove device');
    }
  };

  const handleExport = async (format: ExportFormat, range: '24h' | '7d' | '30d' | 'all') => {
    setExporting(true);
    setShowExport(false);
    try {
      const spans = { '24h': 864e5, '7d': 7 * 864e5, '30d': 30 * 864e5 } as const;
      const endTime = Date.now();
      const startTime = range === 'all' ? 0 : endTime - spans[range];
      const blob = await exportDeviceData({ deviceId: device.id, startTime, endTime, format });
      downloadBlob(blob, exportFilename(device.name || device.address, format, range));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (editing) {
    return (
      <div className="device-card">
        <DeviceForm
          device={device}
          onSaved={() => { setEditing(false); onChanged(); }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  // Prefer a manual live read if it's newer than the stored one
  const useLive = live && (!status?.lastSeen || live.at > status.lastSeen);
  const data = useLive ? live!.data : status?.payload ?? null;
  const seenAt = useLive ? live!.at : status?.lastSeen ?? null;
  const online = useLive || !!status?.online;

  const loc = device.locationType ?? 'indoor';
  const ev = data ? evaluate(data, loc) : null;
  const pmAqi = ev?.pm25 != null ? pm25ToAqi(ev.pm25) : null;

  return (
    <div className="device-card">
      {/* ── Header ── */}
      <div className="device-header">
        <div>
          <h3>{device.name || device.address}</h3>
          <div className="device-address">
            <span className={`conn-dot ${online ? 'on' : 'off'}`} title={online ? 'Online' : 'Offline'} />
            {device.address.replace(/^http:\/\//, '')}
            <span className="device-seen">· {online ? 'updated' : 'last seen'} {timeAgo(seenAt, now)}</span>
          </div>
        </div>
        <div className="device-actions">
          <div className="device-actions-group" ref={exportRef}>
            <button onClick={() => setShowExport(v => !v)} className="export-button" title="Export data" disabled={exporting}>
              {exporting ? <Loader2 size={16} className="icon-spin" /> : <Download size={16} />}
            </button>
            {showExport && (
              <div className="export-menu">
                <div className="export-menu-header">Export raw data</div>
                <div className="export-menu-section">
                  {(['24h', '7d', '30d', 'all'] as const).map(r => (
                    <div key={r} className="export-menu-pair">
                      <span className="export-menu-label">{r === 'all' ? 'All' : `Last ${r}`}</span>
                      <button onClick={() => handleExport('csv', r)} className="export-menu-item">CSV</button>
                      <button onClick={() => handleExport('json', r)} className="export-menu-item">JSON</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setEditing(true)} className="edit-button" title="Edit device">
            <Edit size={16} />
          </button>
          <button onClick={handleRefresh} disabled={refreshing} className="refresh-button" title="Read live from device now">
            {refreshing ? <Loader2 size={16} className="icon-spin" /> : <RefreshCw size={16} />}
          </button>
          <button onClick={handleRemove} className="remove-button" title="Remove device">
            <X size={16} />
          </button>
        </div>
      </div>

      {loading && !data && <div className="loading">Loading…</div>}
      {error && <div className="error-message">{error}</div>}
      {!loading && !data && !error && (
        <div className="device-waiting">
          {status?.lastError
            ? <>Can&apos;t reach this monitor yet: {status.lastError}</>
            : <>Waiting for the first reading…</>}
        </div>
      )}
      {data && !online && status?.lastError && (
        <div className="device-offline-note">Offline — {status.lastError}. Showing the last reading.</div>
      )}

      {data && ev && (
        <>
          {(ev.airQuality || ev.comfort) && (
            <div className="aqi-hero dual">
              <div className="aqi-panels">
                {ev.airQuality && (
                  <HeroPanel
                    title="Air Quality"
                    ring="AQ"
                    status={ev.airQuality}
                    description={AQ_DESCRIPTIONS[ev.airQuality.status]}
                  />
                )}
                {ev.airQuality && ev.comfort && <div className="aqi-divider" />}
                {ev.comfort && (
                  <HeroPanel
                    title="Comfort"
                    ring="😌"
                    status={ev.comfort}
                    description={COMFORT_DESCRIPTIONS[ev.comfort.status]}
                  />
                )}
              </div>
              <div className="aqi-hero-footer">
                <span className="location-badge">{loc === 'outdoor' ? '🌳 Outdoor' : '🏠 Indoor'}</span>
                {data.model && <span>Model: {data.model}</span>}
                {data.firmware && <span>FW: {data.firmware}</span>}
                {pmAqi != null && <span>PM2.5 AQI: {pmAqi}</span>}
                <span>Poll: {device.pollingFrequency}s</span>
              </div>
            </div>
          )}

          <div className="device-card-body">
            <div className="metrics-grid">
              <MetricCard icon="💨" label="CO₂" value={fmt(data.rco2, 0)} unit="ppm" status={ev.s.co2} />
              <MetricCard icon="🌿" label="PM2.5" value={fmt(ev.pm25, 1)} unit="µg/m³" status={ev.s.pm25}
                note={data.pm02Compensated != null ? 'compensated' : undefined} />
              <MetricCard icon="🌫️" label="PM1.0" value={fmt(data.pm01, 1)} unit="µg/m³" status={null} />
              <MetricCard icon="🍃" label="PM10" value={fmt(data.pm10, 1)} unit="µg/m³" status={ev.s.pm10} />
              <MetricCard icon="🌡️" label="Temperature" value={fmt(ev.tempF, 1)} unit="°F" status={ev.s.temperature}
                note={data.atmpCompensated != null && data.atmpCompensated !== data.atmp ? 'compensated' : undefined} />
              <MetricCard icon="💧" label="Humidity" value={fmt(ev.hum, 0)} unit="%" status={ev.s.humidity}
                note={data.rhumCompensated != null && data.rhumCompensated !== data.rhum ? 'compensated' : undefined} />
              <MetricCard icon="🧪" label="TVOC Idx" value={fmt(data.tvocIndex, 0)} unit="" status={ev.s.tvoc} />
              <MetricCard icon="⚗️" label="NOx Idx" value={fmt(data.noxIndex, 0)} unit="" status={ev.s.nox} />
              <MetricCard icon="🔬" label="PM0.3" value={fmt(data.pm003Count, 0)} unit="/dL" status={null} />
              <MetricCard icon="📶" label="WiFi" value={fmt(data.wifi, 0)} unit="dBm" status={ev.s.wifi} />
            </div>

            <div className="card-footer-row">
              <div className="last-updated">
                {seenAt && (
                  <>
                    <span className={online ? 'live-dot' : 'stale-dot'} />
                    {new Date(seenAt).toLocaleTimeString()}
                    {useLive && <span className="live-tag">live</span>}
                  </>
                )}
              </div>
              <div className="graph-toggle">
                <button onClick={() => setShowGraphs(v => !v)} className="toggle-graph-button">
                  {showGraphs ? <><ChevronDown size={14} /> Hide Graphs</> : <><ChevronUp size={14} /> Historical Graphs</>}
                </button>
              </div>
            </div>

            {showGraphs && (
              <div className="graphs-wrapper">
                <DeviceGraphs deviceId={device.id} locationType={loc} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function fmt(v: number | null | undefined, digits: number): string | null {
  return v == null ? null : v.toFixed(digits);
}

function HeroPanel({ title, ring, status, description }: {
  title: string;
  ring: string;
  status: AirQualityThreshold;
  description: string;
}) {
  return (
    <div
      className="aqi-panel"
      style={{ background: `linear-gradient(135deg, ${status.bgColor.replace('0.15', '0.28')} 0%, ${status.bgColor} 100%)` }}
    >
      <div className="aqi-ring-wrap">
        <svg viewBox="0 0 80 80">
          <circle className="aqi-arc-bg" cx="40" cy="40" r="32" transform="rotate(-90 40 40)" />
          <circle
            className="aqi-arc-fill"
            cx="40" cy="40" r="32"
            transform="rotate(-90 40 40)"
            stroke={status.color}
            style={{
              strokeDasharray: ARC,
              strokeDashoffset: STATUS_ARC_OFFSET[status.status] ?? 151,
              filter: `drop-shadow(0 0 5px ${status.color}88)`,
            }}
          />
        </svg>
        <div className="aqi-ring-center"><span className="aqi-ring-label">{ring}</span></div>
      </div>
      <div className="aqi-info">
        <div className="aqi-panel-title">{title}</div>
        <div className="aqi-status-row">
          <span className="aqi-dot" style={{ background: status.color, boxShadow: `0 0 8px ${status.color}` }} />
          <span className="aqi-status-label">{status.label}</span>
        </div>
        <div className="aqi-description">{description}</div>
      </div>
    </div>
  );
}

/** Metric tile; hidden entirely when the monitor doesn't have that sensor. */
function MetricCard({ icon, label, value, unit, status, note }: {
  icon: string;
  label: string;
  value: string | null;
  unit: string;
  status: AirQualityThreshold | null;
  note?: string;
}) {
  if (value == null) return null;
  return (
    <div
      className="metric-card primary"
      style={status ? ({ '--metric-color': status.color, '--metric-bg': status.bgColor } as React.CSSProperties) : undefined}
    >
      <span className="metric-icon">{icon}</span>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {unit && <div className="metric-unit">{unit}</div>}
      {note && <div className="metric-note">({note})</div>}
      {status && <div className="metric-status">{status.label}</div>}
    </div>
  );
}
