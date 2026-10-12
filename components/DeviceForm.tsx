'use client';

import { useState } from 'react';
import { addDevice, updateDevice, fetchLive } from '@/lib/client';
import { validateDeviceAddress } from '@/lib/addressValidation';
import type { Device, LocationType, AirGradientMeasures } from '@/lib/types';
import { Loader2, PlugZap } from 'lucide-react';

interface DeviceFormProps {
  /** Omit to add a new device */
  device?: Device;
  onSaved: () => void;
  onCancel?: () => void;
}

/** Add / edit form, with a live "Test connection" check against the device. */
export default function DeviceForm({ device, onSaved, onCancel }: DeviceFormProps) {
  const editing = !!device;
  const [address, setAddress] = useState(device?.address.replace(/^http:\/\//, '') ?? '');
  const [name, setName] = useState(device?.name ?? '');
  const [pollingFrequency, setPollingFrequency] = useState(device?.pollingFrequency ?? 30);
  const [locationType, setLocationType] = useState<LocationType>(device?.locationType ?? 'indoor');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AirGradientMeasures | null>(null);

  // Client-side check is format-only; the server enforces the private-network policy.
  const check = () => {
    const v = validateDeviceAddress(address, { allowLoopback: true });
    if (!v.valid || !v.normalized) throw new Error(v.error ?? 'Invalid address');
    return v.normalized;
  };

  const handleTest = async () => {
    setError(null);
    setTestResult(null);
    setTesting(true);
    try {
      const data = await fetchLive(check());
      setTestResult(data);
      if (!name.trim() && data.model) {
        setName(`${data.model}${data.serialno ? ` ${data.serialno.slice(-4)}` : ''}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        address: check(),
        name: name.trim() || undefined,
        pollingFrequency: Math.max(5, Math.min(3600, pollingFrequency)),
        locationType,
      };
      if (editing) await updateDevice(device.id, payload);
      else await addDevice(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save device');
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || testing;
  const idPrefix = editing ? `edit-${device.id}` : 'add';

  return (
    <form onSubmit={handleSubmit} className="add-device-form">
      <h2>{editing ? 'Edit Device' : 'Add Device'}</h2>
      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label htmlFor={`${idPrefix}-address`}>
          Device IP Address <span className="required">*</span>
        </label>
        <div className="address-row">
          <input
            id={`${idPrefix}-address`}
            type="text"
            inputMode="decimal"
            value={address}
            onChange={e => { setAddress(e.target.value); setTestResult(null); }}
            placeholder="192.168.1.100"
            disabled={busy}
            required
          />
          <button type="button" className="test-button" onClick={handleTest} disabled={busy || !address.trim()}>
            {testing ? <Loader2 size={14} className="icon-spin" /> : <PlugZap size={14} />}
            Test
          </button>
        </div>
        <small>
          Your monitor&apos;s local IP, shown on its display or in your router. The local server API
          must be enabled (it is by default on current firmware).
        </small>
        {testResult && (
          <div className="test-result">
            ✓ Connected — {testResult.model ?? 'AirGradient'}
            {testResult.serialno && <> · S/N {testResult.serialno}</>}
            {testResult.firmware && <> · FW {testResult.firmware}</>}
            {testResult.rco2 != null && <> · CO₂ {Math.round(testResult.rco2)} ppm</>}
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor={`${idPrefix}-name`}>Name (optional)</label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          value={name}
          maxLength={80}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Living Room"
          disabled={busy}
        />
      </div>

      <div className="form-group">
        <label>Location</label>
        <div className="location-toggle">
          {(['indoor', 'outdoor'] as LocationType[]).map(loc => (
            <button
              key={loc}
              type="button"
              className={`location-toggle-btn${locationType === loc ? ' active' : ''}`}
              onClick={() => setLocationType(loc)}
              disabled={busy}
            >
              {loc === 'indoor' ? '🏠 Indoor' : '🌳 Outdoor'}
            </button>
          ))}
        </div>
        <small>Sets the temperature and humidity comfort ranges</small>
      </div>

      <div className="form-group">
        <label htmlFor={`${idPrefix}-freq`}>Poll every (seconds)</label>
        <input
          id={`${idPrefix}-freq`}
          type="number"
          value={pollingFrequency}
          onChange={e => setPollingFrequency(parseInt(e.target.value, 10) || 30)}
          min={5}
          max={3600}
          step={5}
          disabled={busy}
          required
        />
        <small>5–3600 seconds. AirGradient monitors refresh their readings about every 5 s; 30 s is a good default.</small>
      </div>

      <div className="form-actions">
        <button type="submit" disabled={busy} className="submit-button">
          {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Add Device'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="cancel-button" disabled={submitting}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
