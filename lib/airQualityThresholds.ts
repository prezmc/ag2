export type AirQualityStatus = 'good' | 'moderate' | 'unhealthy' | 'very-unhealthy' | 'hazardous';
export type LocationType = 'indoor' | 'outdoor';

export interface AirQualityThreshold {
  status: AirQualityStatus;
  color: string;
  bgColor: string;
  label: string;
}

export interface Thresholds {
  co2: { [key in AirQualityStatus]?: number };
  pm25: { [key in AirQualityStatus]?: number };
  pm10: { [key in AirQualityStatus]?: number };
  tvoc: { [key in AirQualityStatus]?: number };
  nox: { [key in AirQualityStatus]?: number };
  humidity: { [key in AirQualityStatus]?: number | { min?: number; max?: number } };
  temperature: { [key in AirQualityStatus]?: number | { min?: number; max?: number } };
  wifi: { [key in AirQualityStatus]?: number };
}

// Air quality metrics — same EPA/WHO standards regardless of location
const AQ_THRESHOLDS = {
  co2: {
    good: 1000,               // <= 1000 ppm
    moderate: 2000,           // 1001–2000 ppm
    unhealthy: 5000,          // 2001–5000 ppm
    'very-unhealthy': 10000,  // 5001–10000 ppm
    hazardous: 15000,         // > 10000 ppm
  },
  pm25: {
    good: 12,                 // 0–12 µg/m³  (AQI 0–50)
    moderate: 35,             // 12–35 µg/m³ (AQI 51–100)
    unhealthy: 55,            // 35–55 µg/m³ (AQI 101–150)
    'very-unhealthy': 150,    // 55–150 µg/m³ (AQI 151–200)
    hazardous: 250,           // > 250 µg/m³  (AQI 300+)
  },
  pm10: {
    good: 54,
    moderate: 154,
    unhealthy: 254,
    'very-unhealthy': 354,
    hazardous: 424,
  },
  tvoc: {
    good: 100,
    moderate: 500,
    unhealthy: 1000,
    'very-unhealthy': 3000,
    hazardous: 3000,
  },
  nox: {
    good: 50,
    moderate: 100,
    unhealthy: 200,
    'very-unhealthy': 400,
    hazardous: 400,
  },
  wifi: {
    good: -60,
    moderate: -70,
    unhealthy: -80,
    'very-unhealthy': -90,
  },
};

// Comfort profiles — vary by location
const COMFORT_THRESHOLDS: Record<LocationType, Pick<Thresholds, 'temperature' | 'humidity'>> = {
  indoor: {
    // Tighter ranges: optimised for human habitation
    temperature: {
      good:     { min: 68, max: 76 },   // Classic ASHRAE comfort zone
      moderate: { min: 60, max: 82 },   // Slightly outside ideal
      unhealthy:{ min: 50, max: 92 },   // Uncomfortably cold/hot
      'very-unhealthy': { min: 32, max: 105 },
      // hazardous: outside that
    },
    humidity: {
      good:     { min: 40, max: 55 },   // Ideal indoor RH
      moderate: { min: 30, max: 65 },
      unhealthy:{ min: 20, max: 75 },
      'very-unhealthy': { min: 10, max: 85 },
    },
  },
  outdoor: {
    // Wider ranges: seasonal variation is normal outdoors
    temperature: {
      good:     { min: 55, max: 85 },   // Pleasant day
      moderate: { min: 35, max: 95 },   // Cool/warm but fine
      unhealthy:{ min: 20, max: 105 },  // Cold/hot weather advisory
      'very-unhealthy': { min: 0, max: 115 },
      // hazardous: <0°F or >115°F
    },
    humidity: {
      good:     { min: 25, max: 75 },   // Comfortable outdoors
      moderate: { min: 15, max: 85 },   // Noticeably dry or muggy
      unhealthy:{ min: 5,  max: 92 },   // Very dry or oppressive
      // very-unhealthy: outside that
    },
  },
};

function getThresholds(locationType: LocationType = 'indoor'): Thresholds {
  return {
    ...AQ_THRESHOLDS,
    ...COMFORT_THRESHOLDS[locationType],
  };
}

export function getAirQualityStatus(
  type: 'co2' | 'pm25' | 'pm10' | 'tvoc' | 'nox' | 'humidity' | 'temperature' | 'wifi',
  value: number,
  locationType: LocationType = 'indoor',
): AirQualityStatus {
  const thresholds = getThresholds(locationType);
  const typeThresholds = thresholds[type];
  
  if (!typeThresholds) {
    return 'good';
  }

  // Special handling for humidity and temperature (range-based, up to 5 levels)
  if (type === 'humidity' || type === 'temperature') {
    type RangeEntry = { min?: number; max?: number };
    const levels: AirQualityStatus[] = ['good', 'moderate', 'unhealthy', 'very-unhealthy', 'hazardous'];

    const inRange = (entry: RangeEntry | undefined, v: number): boolean => {
      if (!entry) return false;
      const lo = entry.min ?? -Infinity;
      const hi = entry.max ?? Infinity;
      return v >= lo && v <= hi;
    };

    // Walk from best → worst; first level whose range contains the value wins
    for (const level of levels) {
      const entry = typeThresholds[level] as RangeEntry | undefined;
      if (entry && inRange(entry, value)) return level;
    }

    // Outside all defined ranges — use worst defined level
    for (let i = levels.length - 1; i >= 0; i--) {
      if (typeThresholds[levels[i]] !== undefined) return levels[i];
    }
    return 'hazardous';
  }

  // Special handling for WiFi (negative values, higher is better)
  if (type === 'wifi') {
    // WiFi values are negative, so we check if value is greater than (less negative than) thresholds
    const wifiThresholds = typeThresholds as { [key in AirQualityStatus]?: number };
    if (wifiThresholds.hazardous !== undefined && value < wifiThresholds.hazardous) {
      return 'hazardous';
    }
    if (wifiThresholds['very-unhealthy'] !== undefined && value < wifiThresholds['very-unhealthy']) {
      return 'very-unhealthy';
    }
    if (wifiThresholds.unhealthy !== undefined && value < wifiThresholds.unhealthy) {
      return 'unhealthy';
    }
    if (wifiThresholds.moderate !== undefined && value < wifiThresholds.moderate) {
      return 'moderate';
    }
    // value >= moderate threshold (better signal)
    return 'good';
  }

  // For other metrics, check from most severe to least severe
  // Thresholds represent the upper bound of each category (inclusive)
  // Type guard to check if threshold is a number (not an object)
  const isNumberThreshold = (t: number | { min?: number; max?: number } | undefined): t is number => {
    return typeof t === 'number';
  };

  if (isNumberThreshold(typeThresholds.hazardous) && value > typeThresholds.hazardous) {
    return 'hazardous';
  }
  if (isNumberThreshold(typeThresholds['very-unhealthy']) && value > typeThresholds['very-unhealthy']) {
    return 'very-unhealthy';
  }
  if (isNumberThreshold(typeThresholds.unhealthy) && value > typeThresholds.unhealthy) {
    return 'unhealthy';
  }
  if (isNumberThreshold(typeThresholds.moderate) && value > typeThresholds.moderate) {
    return 'moderate';
  }
  // value <= moderate threshold (or <= good threshold if no moderate)
  return 'good';
}

export function getStatusColor(status: AirQualityStatus): AirQualityThreshold {
  const colors: { [key in AirQualityStatus]: AirQualityThreshold } = {
    good: {
      status: 'good',
      color: '#10b981', // Green
      bgColor: 'rgba(16, 185, 129, 0.15)', // Darker green with transparency
      label: 'Good',
    },
    moderate: {
      status: 'moderate',
      color: '#f59e0b', // Amber/Yellow
      bgColor: 'rgba(245, 158, 11, 0.15)', // Darker amber with transparency
      label: 'Moderate',
    },
    unhealthy: {
      status: 'unhealthy',
      color: '#f97316', // Orange
      bgColor: 'rgba(249, 115, 22, 0.15)', // Darker orange with transparency
      label: 'Unhealthy',
    },
    'very-unhealthy': {
      status: 'very-unhealthy',
      color: '#ef4444', // Red
      bgColor: 'rgba(239, 68, 68, 0.15)', // Darker red with transparency
      label: 'Very Unhealthy',
    },
    hazardous: {
      status: 'hazardous',
      color: '#7c3aed', // Purple
      bgColor: 'rgba(124, 58, 237, 0.15)', // Darker purple with transparency
      label: 'Hazardous',
    },
  };

  return colors[status];
}

export function getMetricStatus(
  type: 'co2' | 'pm25' | 'pm10' | 'tvoc' | 'nox' | 'humidity' | 'temperature' | 'wifi',
  value: number,
  locationType: LocationType = 'indoor',
): AirQualityThreshold {
  const status = getAirQualityStatus(type, value, locationType);
  return getStatusColor(status);
}

