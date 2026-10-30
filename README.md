# AG2 — AirGradient Local

A self-hosted dashboard and history for **AirGradient** air quality monitors.
It reads each monitor's built-in **local server API** over your LAN, with no AirGradient
cloud and no third-party services.

![AG2 dashboard showing two monitors with live readings](docs/screenshots/dashboard.webp)

## Features

- **Background polling.** Every monitor is polled on its own interval (5–3600 s) and
  stored in TimescaleDB. This runs whether or not a browser is open.
- **Live dashboard.** One card per monitor. Each card has Air Quality and Comfort rings,
  per-metric severity colors, PM2.5 AQI, and an online/offline state with "last seen".
- **Summary strip.** A chip per monitor showing its headline number and overall status.
- **History charts.** Ranges from 1 hour to all-time. The line changes color as values
  cross severity levels. The server averages the data into time buckets and picks
  raw, hourly or daily tables, so long ranges load quickly.
- **Model-aware.** Tiles and charts only appear for sensors your monitor actually has.
  For example, an Open Air unit shows no CO₂ or TVOC.
- **Indoor/outdoor profiles.** Indoor and outdoor monitors use different
  temperature and humidity comfort ranges.
- **Test connection.** When adding a monitor, AG2 reads it live and fills in a
  suggested name from the model and serial number.
- **Export.** Raw CSV or JSON for the last 24 h, 7 d, 30 d or all time.
- **Locked-down device access.** Only private-network IPv4 addresses are accepted.
  Redirects are blocked, every request times out after 10 s, and only expected
  fields are kept from the response.

## Screenshots

| History charts (colored by severity) | Adding a monitor | On a phone |
|---|---|---|
| ![Charts of CO₂, PM, temperature, humidity and VOC/NOx over 24 hours, with lines turning amber or orange above healthy levels](docs/screenshots/charts.webp) | ![Add Monitor form after a successful connection test](docs/screenshots/add-monitor.webp) | ![Dashboard on a phone-sized screen](docs/screenshots/phone.webp) |

*Screenshots use demo monitors and sample data.*

## Install

You need [Docker](https://www.docker.com/products/docker-desktop/). Then:

```bash
git clone https://github.com/prezmc/ag2.git
cd ag2
docker compose up -d
```

The first start builds AG2 on your computer (3–5 minutes). Then open
<http://localhost:3000>, go to **Settings → Add Monitor**, enter your monitor's IP address
(for example `192.168.1.50`), click **Test**, then **Add Monitor**.

**Nothing needs configuring.** On first start AG2 creates its own random database password
and its database tables. AG2 itself is built from this repository on your machine. Docker
only downloads the official Node.js and TimescaleDB base images. No accounts, no cloud.

To update: `git pull && docker compose up -d --build`.

No git? Use **Code → Download ZIP** on GitHub. The full step-by-step guide, including
Portainer, Synology and Unraid, is in **[INSTALL.md](INSTALL.md)**.

### Requirements on the monitor

The local server API is enabled by default on AirGradient firmware 3.x. You can check it
from any computer on the LAN:

```bash
curl http://192.168.1.50/measures/current
```

## Local development

```bash
npm install

# 1. A database (any TimescaleDB works; the app creates its tables on start)
docker run -d --name ag2-db -p 5432:5432 \
  -e POSTGRES_DB=ag2 -e POSTGRES_USER=ag2 -e POSTGRES_PASSWORD=dev \
  timescale/timescaledb:latest-pg16

# 2. A fake monitor (optional): add it in the app as 127.0.0.1:8081
npm run mock-device                       # indoor ONE
node scripts/mock-device.js 8082 outdoor  # Open Air, no CO₂

# 3. The app
DATABASE_URL=postgresql://ag2:dev@localhost:5432/ag2 \
DATA_DIR=./data ALLOW_LOOPBACK_DEVICES=true \
npm run dev
```

## Configuration

All optional. Put them in a `.env` file next to `docker-compose.yml` (see `.env.example`).

| Variable | Default | Purpose |
|---|---|---|
| `AG2_PORT` | `3000` | Port the dashboard is published on |
| `AG2_API_KEY` | empty (off) | Requires an `X-API-Key` header on API calls that don't come from the dashboard itself |
| `DB_PASSWORD` | not needed | Only for [moving an older install](INSTALL.md#moving-an-older-install-to-this-version). New installs get a random password automatically |

For development (`npm run dev`) the app also reads:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | built from the generated password | Full database connection string |
| `DATA_DIR` | `/app/data` | Where `devices.json` lives |
| `ALLOW_LOOPBACK_DEVICES` | `false` | Allow `127.0.0.1` device addresses (for the mock monitor) |
| `AG2_DISABLE_POLLER` | `false` | Start the web app without background polling |

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/devices` | List monitors |
| POST | `/api/devices` | Add a monitor: `{ address, name?, pollingFrequency, locationType }` |
| PUT | `/api/devices/:id` | Update a monitor |
| DELETE | `/api/devices/:id` | Remove a monitor **and its history** |
| GET | `/api/status[?id=]` | Latest stored reading and online state |
| GET | `/api/proxy?address=` | Live read straight from a monitor |
| GET | `/api/measurements?deviceId=&startTime=&endTime=&resolution=` | History; omit `resolution` to get raw rows |
| GET | `/api/health` | Health check (no auth required, counts only) |

See [docs/architecture.md](docs/architecture.md) for how the pieces fit together.

## Security

See [SECURITY.md](SECURITY.md) for the security model and how to report a problem.

## License

MIT — see [LICENSE](LICENSE).
