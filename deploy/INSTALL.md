# Installing AirGradient Local (AG2)

AG2 is a dashboard for **AirGradient** air quality monitors. It runs on a computer on
your home network (Mac, Windows, Linux, Synology, Unraid, Raspberry Pi 4/5) and reads
your monitors directly over the local network. It records history and shows live
readings and charts. No AirGradient account or cloud connection is needed.

---

## What you need

1. **Docker** on the computer that will run AG2:
   - Mac or Windows: install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and open it once.
   - Linux: install Docker Engine with the Compose plugin.
   - Synology, Unraid, Portainer: use their "Stack" / "Compose" feature (see the bottom of this page).
2. **Your monitor's IP address.** It's shown on the monitor's screen, or in your router's
   list of connected devices. It looks like `192.168.1.50`.
3. That computer and your monitors on **the same home network**.

---

## Install (about 2 minutes)

### Step 1: Get the setup files

Open a terminal (on Mac, **Terminal**; on Windows, **PowerShell**), then run:

```bash
mkdir ag2
cd ag2
docker run --rm -v "${PWD}:/out" prezmcmahon/ag2 setup
```

This puts three files in the new `ag2` folder:

| File | What it is |
|---|---|
| `docker-compose.yml` | Tells Docker what to run. You don't need to edit it. |
| `.env.example` | Optional settings: port, password, version. |
| `INSTALL.md` | This guide. |

> No terminal access? Copy the `docker-compose.yml` text from the Docker Hub page
> into a file with that name instead.

### Step 2: Start AG2

```bash
docker compose up -d
```

The first start downloads about 500 MB and takes a minute or two.

### Step 3: Open the dashboard

In a browser, go to **http://localhost:3000** on the same computer, or
**http://COMPUTER-IP:3000** from a phone or another computer.

### Step 4: Add your monitor

1. Click **⚙ Settings → + Add Monitor**.
2. Type the monitor's IP address, for example `192.168.1.50`, and click **Test**.
   You should see "✓ Connected" along with its model.
3. Choose **Indoor** or **Outdoor**, then click **Add Monitor**.

Readings appear within about 30 seconds. Repeat for each monitor you have.

---

## Everyday commands

Run these from the `ag2` folder:

| To… | Run |
|---|---|
| Stop AG2 (data is kept) | `docker compose down` |
| Start it again | `docker compose up -d` |
| Update to the newest version | `docker compose pull && docker compose up -d` |
| See what it's doing | `docker compose logs -f app` |

AG2 restarts on its own after a reboot as long as Docker is running.

---

## Optional settings

Nothing has to be configured. To change something:

```bash
cp .env.example .env      # Windows PowerShell: copy .env.example .env
```

Open `.env` in any text editor, change the setting, save, then run `docker compose up -d`.

The most common change is **port 3000 already in use**: set `AG2_PORT=3001`, or any free
port, and open the dashboard on that port instead.

---

## Troubleshooting

**"Test" says it can't connect or timed out**
- Check the IP address on the monitor's display. The monitor's IP can change; give it a
  fixed (reserved) address in your router so it stays the same.
- The computer running AG2 must be on the same network as the monitor. Guest Wi-Fi
  networks usually can't reach other devices.
- From that computer, open `http://MONITOR-IP/measures/current` in a browser. You should
  see a line of numbers. If you don't, the monitor isn't reachable from that computer.

**"Address must be on your local network"**
AG2 accepts only home-network addresses (`192.168.x.x`, `10.x.x.x`, `172.16–31.x.x`).
Enter just the numbers, without `http://` or anything after them.

**The dashboard won't open**
Run `docker compose ps`. Both `app` and `db` should show "running" or "healthy". If not,
run `docker compose logs app` to see what went wrong.

**Start over completely (deletes all history)**

```bash
docker compose down -v
docker compose up -d
```

---

## Synology / Unraid / Portainer

Create a new **Stack** (Portainer, Unraid Compose Manager) or **Project** (Synology
Container Manager) and paste the contents of `docker-compose.yml`. To change settings,
add them as environment variables in that screen (`AG2_PORT`, `DB_PASSWORD`, …)
instead of using a `.env` file.

---

## Is it safe to open to the internet?

AG2 has no login screen. Use it on your home network. To see it while away, use a VPN
(such as Tailscale or WireGuard) rather than forwarding a port on your router.
