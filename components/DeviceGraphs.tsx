'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getMeasurements } from '@/lib/client';
import { getAirQualityStatus, getStatusColor } from '@/lib/airQualityThresholds';
import { pm25Of, tempCOf, humidityOf, cToF } from '@/lib/types';
import type { StoredMeasurement, LocationType } from '@/lib/types';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

// Base fill color per metric for gradient area backgrounds
const METRIC_FILL: Record<string, string> = {
  co2:         '#818cf8',
  pm25:        '#f472b6',
  pm10:        '#38bdf8',
  temperature: '#fb923c',
  humidity:    '#4ecdc4',
  tvoc:        '#fde68a',
  nox:         '#6ee7b7',
};

interface DeviceGraphsProps {
  deviceId: string;
  locationType: LocationType;
}

type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d' | '1y' | 'all';

// null means "from the beginning of time"
const RANGE_MS: Record<TimeRange, number | null> = {
  '1h':  60 * 60 * 1000,
  '6h':  6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d':  7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '1y':  365 * 24 * 60 * 60 * 1000,
  'all': null,
};

// Bucket size per range (seconds) — the server averages into these buckets and
// picks raw / hourly / daily tables, so the browser never downloads raw history.
const RESOLUTION_SEC: Record<TimeRange, number> = {
  '1h':  15,
  '6h':  90,
  '24h': 300,
  '7d':  1800,
  '30d': 7200,
  '1y':  86400,
  'all': 86400,
};

// MARK: - Severity segment computation

type ThresholdKey = 'co2' | 'pm25' | 'pm10' | 'tvoc' | 'nox' | 'humidity' | 'temperature';

interface SegmentLine {
  dataKey: string;
  color: string;
}

type ChartEntry = Record<string, number | null | undefined>;

function buildSegments(
  data: ChartEntry[],
  valueKey: string,
  thresholdKey: ThresholdKey,
  locationType: LocationType,
): { lines: SegmentLine[]; augmented: ChartEntry[] } {
  if (data.length === 0) return { lines: [], augmented: [] };

  // Pass 1: assign a segment index to each data point
  const segNums: number[] = new Array(data.length).fill(-1);
  const segColors: string[] = [];
  let currentSeg = -1;
  let currentStatus = '';

  for (let i = 0; i < data.length; i++) {
    const val = data[i][valueKey];
    if (val == null) continue;
    const status = getAirQualityStatus(thresholdKey, val as number, locationType);
    if (status !== currentStatus) {
      currentSeg++;
      currentStatus = status;
      segColors[currentSeg] = getStatusColor(status).color;
    }
    segNums[i] = currentSeg;
  }

  if (currentSeg < 0) return { lines: [], augmented: data };

  // Pass 2: build augmented data — add per-segment keys, with overlap at boundaries
  const aug: ChartEntry[] = data.map((d, i) => {
    const result: ChartEntry = { ...d };
    const seg = segNums[i];
    if (seg < 0) return result;

    const val = d[valueKey] as number;
    result[`${valueKey}_s${seg}`] = val;

    // Overlap: also assign current point to the previous segment at a boundary
    if (i > 0 && segNums[i - 1] >= 0 && segNums[i - 1] !== seg) {
      result[`${valueKey}_s${segNums[i - 1]}`] = val;
    }

    return result;
  });

  // Overlap: assign each pre-boundary point to the next segment
  for (let i = 1; i < aug.length; i++) {
    if (segNums[i] >= 0 && segNums[i - 1] >= 0 && segNums[i] !== segNums[i - 1]) {
      const prevVal = data[i - 1][valueKey];
      if (prevVal != null) {
        aug[i - 1][`${valueKey}_s${segNums[i]}`] = prevVal as number;
      }
    }
  }

  const lines = segColors.map((color, idx) => ({
    dataKey: `${valueKey}_s${idx}`,
    color,
  }));

  return { lines, augmented: aug };
}

// MARK: - Component

export default function DeviceGraphs({ deviceId, locationType }: DeviceGraphsProps) {
  const [measurements, setMeasurements] = useState<StoredMeasurement[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [loading, setLoading] = useState(true);

  useEffect(() => { setMeasurements([]); }, [timeRange]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const now = Date.now();
      const rangeMs = RANGE_MS[timeRange];
      const startTime = rangeMs !== null ? now - rangeMs : 0;
      const data = await getMeasurements(deviceId, {
        startTime,
        endTime: now,
        resolution: RESOLUTION_SEC[timeRange],
      });
      setMeasurements(data);
    } catch (error) {
      console.error('Error loading graph data:', error);
    } finally {
      setLoading(false);
    }
  }, [deviceId, timeRange]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    if (timeRange === '1h') return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (timeRange === '6h') return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (timeRange === '24h') return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (timeRange === '7d') return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' });
    if (timeRange === '30d') return date.toLocaleString([], { month: 'short', day: 'numeric' });
    return date.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatAxisTime = (timestamp: number) => {
    const date = new Date(timestamp);
    switch (timeRange) {
      case '1h':  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
      case '6h':  return date.toLocaleTimeString([], { hour: 'numeric', hour12: true });
      case '24h': {
        const isToday = date.toDateString() === new Date().toDateString();
        return isToday
          ? date.toLocaleTimeString([], { hour: 'numeric', hour12: true })
          : date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', hour12: true });
      }
      case '7d':  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', hour12: true });
      case '30d': return date.toLocaleString([], { month: 'short', day: 'numeric' });
      case '1y':  return date.toLocaleString([], { month: 'short' });
      case 'all': return date.toLocaleString([], { month: 'short', year: '2-digit' });
      default:    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const domainStart = useMemo(() => {
    const rangeMs = RANGE_MS[timeRange];
    if (rangeMs !== null) return Date.now() - rangeMs;
    return measurements.length > 0
      ? measurements[0].timestamp
      : Date.now() - 365 * 24 * 60 * 60 * 1000;
  }, [timeRange, measurements]);

  const ticks = useMemo(() => {
    const now = Date.now();
    const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;
    const tickInterval: Record<TimeRange, number> = {
      '1h':  15 * 60 * 1000,
      '6h':  60 * 60 * 1000,
      '24h': 4 * 60 * 60 * 1000,
      '7d':  24 * 60 * 60 * 1000,
      '30d': 5 * 24 * 60 * 60 * 1000,
      '1y':  MS_PER_MONTH,
      'all': 3 * MS_PER_MONTH,
    };
    const interval = tickInterval[timeRange];
    const start = domainStart;
    const firstTick = Math.ceil(start / interval) * interval;
    const result: number[] = [];
    for (let t = firstTick; t <= now; t += interval) result.push(t);
    return result;
  }, [timeRange, domainStart]);

  // Base chart data
  const chartData = useMemo(() => measurements.map((m) => ({
    timestamp: m.timestamp,
    co2: m.rco2,
    pm25: pm25Of(m),
    pm10: m.pm10,
    temperature: (() => { const c = tempCOf(m); return c == null ? null : Math.round(cToF(c) * 10) / 10; })(),
    humidity: humidityOf(m),
    tvoc: m.tvocIndex,
    nox: m.noxIndex,
  })), [measurements]);

  // Severity-segmented data for all metrics, memoized
  const { segmentedData, co2Lines, pm25Lines, pm10Lines, tempLines, humLines, tvocLines, noxLines } =
    useMemo(() => {
      const co2Result   = buildSegments(chartData as unknown as ChartEntry[], 'co2',         'co2', locationType);
      const pm25Result  = buildSegments(chartData as unknown as ChartEntry[], 'pm25',        'pm25', locationType);
      const pm10Result  = buildSegments(chartData as unknown as ChartEntry[], 'pm10',        'pm10', locationType);
      const tempResult  = buildSegments(chartData as unknown as ChartEntry[], 'temperature', 'temperature', locationType);
      const humResult   = buildSegments(chartData as unknown as ChartEntry[], 'humidity',    'humidity', locationType);
      const tvocResult  = buildSegments(chartData as unknown as ChartEntry[], 'tvoc',        'tvoc', locationType);
      const noxResult   = buildSegments(chartData as unknown as ChartEntry[], 'nox',         'nox', locationType);

      // Merge all augmented keys into a single data array
      const segmentedData = chartData.map((base, i) => ({
        ...base,
        ...co2Result.augmented[i],
        ...pm25Result.augmented[i],
        ...pm10Result.augmented[i],
        ...tempResult.augmented[i],
        ...humResult.augmented[i],
        ...tvocResult.augmented[i],
        ...noxResult.augmented[i],
      }));

      return {
        segmentedData,
        co2Lines:  co2Result.lines,
        pm25Lines: pm25Result.lines,
        pm10Lines: pm10Result.lines,
        tempLines: tempResult.lines,
        humLines:  humResult.lines,
        tvocLines: tvocResult.lines,
        noxLines:  noxResult.lines,
      };
    }, [chartData, locationType]);

  // Only draw charts for sensors this monitor actually has
  const has = useMemo(() => {
    const any = (k: keyof (typeof chartData)[number]) => chartData.some(d => d[k] != null);
    return {
      co2: any('co2'),
      air: any('co2') || any('pm25') || any('pm10'),
      temp: any('temperature'),
      hum: any('humidity'),
      voc: any('tvoc') || any('nox'),
    };
  }, [chartData]);

  if (loading && measurements.length === 0) {
    return <div className="graph-loading">Loading graph data...</div>;
  }

  if (measurements.length === 0) {
    return <div className="graph-empty">No historical data available yet. Data will appear as measurements are collected.</div>;
  }

  const showDots = measurements.length <= 250;

  const xAxisProps = {
    dataKey: 'timestamp' as const,
    type: 'number' as const,
    domain: [domainStart, Date.now()] as [number, number],
    ticks,
    tickFormatter: formatAxisTime,
    style: { fontSize: '0.75rem' },
    angle: -45,
    textAnchor: 'end' as const,
    height: 60,
  };

  const tooltipProps = {
    labelFormatter: (value: number) => formatTime(value),
    contentStyle: { background: 'rgba(10,22,40,0.92)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, backdropFilter: 'blur(12px)' },
    itemStyle: { padding: '1px 0', fontSize: '0.8rem' },
    labelStyle: { color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', marginBottom: 4 },
  };

  // Render severity-segmented Line components for a metric
  const renderLines = (segments: SegmentLine[], name: string, yAxisId = 'left') =>
    segments.map((seg) => (
      <Line
        key={seg.dataKey}
        yAxisId={yAxisId}
        type="monotone"
        dataKey={seg.dataKey}
        stroke={seg.color}
        strokeWidth={2}
        dot={showDots ? { r: 2, fill: seg.color } : false}
        connectNulls={false}
        legendType="none"
        name={name}
        isAnimationActive={false}
      />
    ));

  // Render a gradient-filled area beneath a metric line
  const renderArea = (dataKey: string, gradientId: string, yAxisId = 'left') => (
    <Area
      key={`area-${dataKey}`}
      yAxisId={yAxisId}
      type="monotone"
      dataKey={dataKey}
      fill={`url(#${gradientId})`}
      stroke="none"
      isAnimationActive={false}
      legendType="none"
      name=""
      connectNulls={false}
      activeDot={false}
    />
  );

  const gridProps = { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.07)' };
  const yAxisProps = { yAxisId: 'left' as const, domain: ['auto', 'auto'] as ['auto', 'auto'], stroke: 'rgba(255,255,255,0.2)', tick: { fill: 'rgba(255,255,255,0.4)', fontSize: 11 } };

  return (
    <div className="device-graphs">
      <div className="graph-controls">
        <label>Time Range: </label>
        {(['1h', '6h', '24h', '7d', '30d', '1y', 'all'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={timeRange === range ? 'active' : ''}
          >
            {range}
          </button>
        ))}
        <span className="graph-point-count" title="Data points shown in graphs">
          {measurements.length} points
        </span>
      </div>

      <div className="graphs-container">

        {/* ── Air Quality ── */}
        {has.air && (
        <div className="graph-section">
          <div className="graph-section-header">
            <h4>Air Quality</h4>
            <div className="graph-legend">
              <span style={{ color: METRIC_FILL.co2,  fontSize: '0.72rem' }}>■ CO₂ (ppm)</span>
              <span style={{ color: METRIC_FILL.pm25, fontSize: '0.72rem' }}>■ PM2.5 (µg/m³)</span>
              <span style={{ color: METRIC_FILL.pm10, fontSize: '0.72rem' }}>■ PM10 (µg/m³)</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={segmentedData}>
              <defs>
                <linearGradient id="fillCo2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={METRIC_FILL.co2}  stopOpacity={0.28} />
                  <stop offset="95%" stopColor={METRIC_FILL.co2}  stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillPm25" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={METRIC_FILL.pm25} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={METRIC_FILL.pm25} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillPm10" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={METRIC_FILL.pm10} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={METRIC_FILL.pm10} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip {...tooltipProps} />
              {/* Threshold: CO₂ 1000 ppm */}
              {has.co2 && <ReferenceLine
                yAxisId="left"
                y={1000}
                stroke="rgba(251,146,60,0.55)"
                strokeDasharray="6 4"
                label={{ value: '1000 ppm', position: 'insideTopLeft', fill: 'rgba(251,146,60,0.7)', fontSize: 10 }}
              />}
              {renderArea('co2',  'fillCo2')}
              {renderArea('pm25', 'fillPm25')}
              {renderArea('pm10', 'fillPm10')}
              {renderLines(co2Lines,  'CO₂ (ppm)')}
              {renderLines(pm25Lines, 'PM2.5 (µg/m³)')}
              {renderLines(pm10Lines, 'PM10 (µg/m³)')}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* ── Temperature ── */}
        {has.temp && (
        <div className="graph-section">
          <div className="graph-section-header">
            <h4>Temperature</h4>
            <div className="graph-legend">
              <span style={{ color: METRIC_FILL.temperature, fontSize: '0.72rem' }}>■ °F</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={segmentedData}>
              <defs>
                <linearGradient id="fillTemp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={METRIC_FILL.temperature} stopOpacity={0.32} />
                  <stop offset="95%" stopColor={METRIC_FILL.temperature} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip {...tooltipProps} />
              {renderArea('temperature', 'fillTemp')}
              {renderLines(tempLines, 'Temperature (°F)', 'left')}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* ── Humidity ── */}
        {has.hum && (
        <div className="graph-section">
          <div className="graph-section-header">
            <h4>Humidity</h4>
            <div className="graph-legend">
              <span style={{ color: METRIC_FILL.humidity, fontSize: '0.72rem' }}>■ %</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={segmentedData}>
              <defs>
                <linearGradient id="fillHum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={METRIC_FILL.humidity} stopOpacity={0.30} />
                  <stop offset="95%" stopColor={METRIC_FILL.humidity} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip {...tooltipProps} />
              {renderArea('humidity', 'fillHum')}
              {renderLines(humLines, 'Humidity (%)', 'left')}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* ── VOC & NOx ── */}
        {has.voc && (
        <div className="graph-section">
          <div className="graph-section-header">
            <h4>VOC &amp; NOx</h4>
            <div className="graph-legend">
              <span style={{ color: METRIC_FILL.tvoc, fontSize: '0.72rem' }}>■ TVOC Index</span>
              <span style={{ color: METRIC_FILL.nox,  fontSize: '0.72rem' }}>■ NOx Index</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={segmentedData}>
              <defs>
                <linearGradient id="fillTvoc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={METRIC_FILL.tvoc} stopOpacity={0.26} />
                  <stop offset="95%" stopColor={METRIC_FILL.tvoc} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillNox" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={METRIC_FILL.nox}  stopOpacity={0.20} />
                  <stop offset="95%" stopColor={METRIC_FILL.nox}  stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip {...tooltipProps} />
              {renderArea('tvoc', 'fillTvoc')}
              {renderArea('nox',  'fillNox')}
              {renderLines(tvocLines, 'TVOC Index')}
              {renderLines(noxLines,  'NOx Index')}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        )}

      </div>
    </div>
  );
}
