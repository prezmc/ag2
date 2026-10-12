#!/usr/bin/env node
/**
 * Mock AirGradient monitor for local development.
 *
 *   npm run mock-device            → indoor ONE on 127.0.0.1:8081
 *   node scripts/mock-device.js 8082 outdoor   → Open Air (no CO₂/TVOC) on :8082
 *
 * Serves GET /measures/current with gently drifting, realistic values in the
 * same shape as firmware 3.x. Add it in the app as 127.0.0.1:8081 with
 * ALLOW_LOOPBACK_DEVICES=true set for the dev server.
 */
const http = require('http');

const port = parseInt(process.argv[2] || '8081', 10);
const kind = process.argv[3] === 'outdoor' ? 'outdoor' : 'indoor';
const t0 = Date.now();
let boot = 0;

function wave(base, amp, periodMin, noise = 0) {
  const t = (Date.now() - t0) / 60000;
  return base + amp * Math.sin((2 * Math.PI * t) / periodMin) + (Math.random() - 0.5) * noise;
}
const r1 = v => Math.round(v * 10) / 10;

function reading() {
  boot++;
  const pm02 = Math.max(0, wave(kind === 'indoor' ? 8 : 14, 6, 20, 2));
  const atmp = wave(kind === 'indoor' ? 22 : 15, 2, 60, 0.2);
  const rhum = wave(kind === 'indoor' ? 45 : 60, 8, 45, 1);
  const common = {
    pm01: r1(pm02 * 0.6),
    pm02: r1(pm02),
    pm10: r1(pm02 * 1.4),
    pm02Compensated: r1(pm02 * 0.9),
    pm003Count: Math.round(pm02 * 120),
    atmp: r1(atmp),
    atmpCompensated: r1(atmp - 0.4),
    rhum: r1(rhum),
    rhumCompensated: r1(rhum + 1.5),
    noxIndex: Math.round(Math.max(1, wave(1, 2, 30, 1))),
    noxRaw: 16000,
    wifi: Math.round(wave(-58, 4, 10, 2)),
    boot,
    bootCount: boot,
    serialno: kind === 'indoor' ? 'ecda3b1a2b3c' : 'ecda3b4d5e6f',
    firmware: '3.3.6',
    ledMode: 'co2',
  };
  if (kind === 'outdoor') return { ...common, model: 'O-1PPT' };
  return {
    ...common,
    model: 'I-9PSL',
    rco2: Math.round(wave(850, 400, 30, 20)),
    tvocIndex: Math.round(Math.max(1, wave(110, 60, 25, 5))),
    tvocRaw: 31000,
  };
}

http
  .createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/measures/current') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(reading()));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`Mock AirGradient (${kind}) on http://127.0.0.1:${port}/measures/current`);
  });
