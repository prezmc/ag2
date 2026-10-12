/**
 * Turns a raw AirGradient reading into severity statuses for each metric,
 * plus the two roll-ups shown on the cards: Air Quality and Comfort.
 */
import { getMetricStatus, AirQualityThreshold } from './airQualityThresholds';
import { pm25Of, tempCOf, humidityOf, cToF } from './types';
import type { AirGradientMeasures, LocationType } from './types';

export const STATUS_RANK: Record<string, number> = {
  good: 0, moderate: 1, unhealthy: 2, 'very-unhealthy': 3, hazardous: 4,
};

export const AQ_DESCRIPTIONS: Record<string, string> = {
  good:             'Air is clean. Great conditions.',
  moderate:         'Acceptable. Sensitive individuals may notice mild effects.',
  unhealthy:        'May affect sensitive groups. Consider ventilating.',
  'very-unhealthy': 'Health effects likely. Improve ventilation now.',
  hazardous:        'Serious health risk. Ventilate immediately.',
};

export const COMFORT_DESCRIPTIONS: Record<string, string> = {
  good:             'Temperature and humidity are comfortable.',
  moderate:         'Slightly outside the comfort range.',
  unhealthy:        'Temperature or humidity may cause discomfort.',
  'very-unhealthy': 'Conditions are quite uncomfortable.',
  hazardous:        'Extreme conditions — take action.',
};

// Ring fill: circumference ≈ 201 (r=32); smaller offset = more of the ring drawn
export const ARC = 201;
export const STATUS_ARC_OFFSET: Record<string, number> = {
  good: 151, moderate: 111, unhealthy: 71, 'very-unhealthy': 41, hazardous: 10,
};

export function worstStatus(statuses: (AirQualityThreshold | null)[]): AirQualityThreshold | null {
  return statuses
    .filter((s): s is AirQualityThreshold => s !== null)
    .reduce<AirQualityThreshold | null>(
      (worst, s) => (!worst || STATUS_RANK[s.status] > STATUS_RANK[worst.status] ? s : worst),
      null,
    );
}

export function timeAgo(ms: number | null, now: number): string {
  if (ms == null) return 'never';
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** Evaluate every metric present in a reading. Missing sensors → null. */
export function evaluate(data: AirGradientMeasures, loc: LocationType) {
  const pm25 = pm25Of(data);
  const tempC = tempCOf(data);
  const tempF = tempC != null ? cToF(tempC) : null;
  const hum = humidityOf(data);
  const st = (type: Parameters<typeof getMetricStatus>[0], v: number | null | undefined) =>
    v == null ? null : getMetricStatus(type, v, loc);

  const s = {
    co2: st('co2', data.rco2),
    pm25: st('pm25', pm25),
    pm10: st('pm10', data.pm10),
    tvoc: st('tvoc', data.tvocIndex),
    nox: st('nox', data.noxIndex),
    temperature: st('temperature', tempF),
    humidity: st('humidity', hum),
    wifi: st('wifi', data.wifi),
  };
  return {
    pm25, tempF, hum, s,
    airQuality: worstStatus([s.co2, s.pm25, s.pm10, s.tvoc, s.nox]),
    comfort: worstStatus([s.temperature, s.humidity]),
  };
}
