'use client';

interface AboutModalProps {
  onClose: () => void;
}

const timeRanges = [
  { range: '1H',  source: 'Raw measurements',  resolution: '15 seconds',  points: '~240' },
  { range: '6H',  source: 'Raw measurements',  resolution: '90 seconds',  points: '~240' },
  { range: '24H', source: 'Raw measurements',  resolution: '5 minutes',   points: '~288' },
  { range: '7D',  source: 'Hourly averages',   resolution: '30 minutes',  points: '~336' },
  { range: '30D', source: 'Hourly averages',   resolution: '2 hours',     points: '~360' },
  { range: '1Y',  source: 'Daily averages',    resolution: '1 day',       points: '~365' },
  { range: 'All', source: 'Daily averages',    resolution: '1 day',       points: 'varies' },
];

export default function AboutModal({ onClose }: AboutModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content about-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>About AirGradient Local</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="about-section">
          <h3>Data Collection</h3>
          <p>
            This server polls each AirGradient monitor&apos;s local API
            (<code>/measures/current</code>) on its configured interval — typically every 30 seconds —
            whether or not a browser is open. Each reading captures CO₂, particulate matter
            (PM0.3 count, PM1, PM2.5, PM10), temperature, humidity, TVOC and NOx indices, and WiFi
            signal strength, depending on which sensors your model has. Nothing goes through
            AirGradient&apos;s cloud.
          </p>
        </div>

        <div className="about-section">
          <h3>Data Storage</h3>
          <p>
            Measurements are stored in a PostgreSQL database using TimescaleDB, a time-series
            extension optimised for sensor data. Raw data is retained for <strong>1 year</strong>.
            Pre-computed hourly averages are kept for <strong>2 years</strong>, and daily averages
            are kept for <strong>10 years</strong>.
          </p>
        </div>

        <div className="about-section">
          <h3>Chart Data by Time Range</h3>
          <p>
            To keep charts fast and readable, each time range queries a different data source
            and resolution:
          </p>
          <table className="about-table">
            <thead>
              <tr>
                <th>Range</th>
                <th>Data Source</th>
                <th>Resolution</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {timeRanges.map((row) => (
                <tr key={row.range}>
                  <td><strong>{row.range}</strong></td>
                  <td>{row.source}</td>
                  <td>{row.resolution}</td>
                  <td>{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="about-note">
            Hourly and daily averages are pre-computed continuously in the background by
            TimescaleDB, so long-range queries remain fast even as data accumulates.
          </p>
        </div>

        <div className="about-section">
          <h3>Air Quality Thresholds</h3>
          <p>Metric severity colours follow these thresholds:</p>
          <ul className="threshold-list">
            <li><span className="sev-good">■</span> <strong>Good</strong> — all readings within comfortable ranges</li>
            <li><span className="sev-moderate">■</span> <strong>Moderate</strong> — slightly elevated, generally acceptable</li>
            <li><span className="sev-unhealthy">■</span> <strong>Unhealthy</strong> — elevated, consider ventilation</li>
            <li><span className="sev-very-unhealthy">■</span> <strong>Very Unhealthy</strong> — take action to improve air quality</li>
            <li><span className="sev-hazardous">■</span> <strong>Hazardous</strong> — immediate action required</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
