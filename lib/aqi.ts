/**
 * EPA AQI utilities — category labels, activity guidance, and unit conversions.
 *
 * PM2.5 breakpoints from EPA Technical Assistance Document (Sept 2018):
 * https://www.airnow.gov/sites/default/files/2020-05/aqi-technical-assistance-document-sept2018.pdf
 *
 * CO₂ thresholds: ASHRAE 62.1 / OSHA / general IAQ guidance
 * TVOC index:     Sensirion SGP40 algorithm output (0–500, baseline ~100)
 */

// ─── Outdoor AQI ─────────────────────────────────────────────────────────────

export type AqiCategory =
  | 'Good'
  | 'Moderate'
  | 'Unhealthy for Sensitive Groups'
  | 'Unhealthy'
  | 'Very Unhealthy'
  | 'Hazardous';

export function aqiCategory(aqi: number): AqiCategory {
  if (aqi <= 50)  return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

/** One-line outdoor activity guidance for a given AQI (EPA recommendations) */
export function aqiActivityGuidance(aqi: number): string {
  if (aqi <= 50)  return 'Safe for all outdoor activity, including vigorous exercise';
  if (aqi <= 100) return 'Generally acceptable — unusually sensitive people may want to limit prolonged exertion';
  if (aqi <= 150) return 'Sensitive groups (asthma, heart/lung conditions) should reduce prolonged outdoor exertion';
  if (aqi <= 200) return 'Everyone should reduce prolonged outdoor exertion';
  if (aqi <= 300) return 'Avoid prolonged outdoor exertion — air is unhealthy for all';
  return 'Avoid all outdoor exertion — hazardous conditions';
}

/** True if vigorous exercise (e.g. cycling) is appropriate for a healthy adult */
export function aqiSafeForVigorousExercise(aqi: number): boolean {
  return aqi <= 100;
}

/** Convert PM2.5 (µg/m³, instantaneous or short-term) to AQI using EPA breakpoints */
export function pm25ToAqi(pm25: number): number {
  const bp = [
    { cLo: 0,     cHi: 12.0,  iLo: 0,   iHi: 50  },
    { cLo: 12.1,  cHi: 35.4,  iLo: 51,  iHi: 100 },
    { cLo: 35.5,  cHi: 55.4,  iLo: 101, iHi: 150 },
    { cLo: 55.5,  cHi: 150.4, iLo: 151, iHi: 200 },
    { cLo: 150.5, cHi: 250.4, iLo: 201, iHi: 300 },
    { cLo: 250.5, cHi: 350.4, iLo: 301, iHi: 400 },
    { cLo: 350.5, cHi: 500.4, iLo: 401, iHi: 500 },
  ];
  const b = bp.find(b => pm25 >= b.cLo && pm25 <= b.cHi);
  if (!b) return pm25 <= 0 ? 0 : 500;
  return Math.round(((b.iHi - b.iLo) / (b.cHi - b.cLo)) * (pm25 - b.cLo) + b.iLo);
}

// ─── Indoor CO₂ ───────────────────────────────────────────────────────────────

/** Context label for CO₂ concentration in ppm */
export function co2Category(ppm: number): string {
  if (ppm < 600)  return 'Excellent (fresh air)';
  if (ppm < 800)  return 'Good';
  if (ppm < 1000) return 'Acceptable';
  if (ppm < 1200) return 'Getting stale — consider ventilating';
  if (ppm < 2000) return 'Poor ventilation — ventilate now';
  return 'Very high — ventilate immediately';
}

// ─── Indoor TVOC ─────────────────────────────────────────────────────────────

/** Context label for Sensirion SGP40 TVOC index (0–500, baseline ~100) */
export function tvocCategory(index: number): string {
  if (index < 150) return 'Good';
  if (index < 250) return 'Moderate — some VOC sources present';
  if (index < 400) return 'Elevated — identify sources and ventilate';
  return 'Very high — ventilate immediately';
}
