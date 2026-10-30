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
   - Synology, Unraid, Portainer: see the bottom of this page.
2. **Your monitor's IP address.** It's shown on the monitor's screen, or in your router's
   list of connected devices. It looks like `192.168.1.50`.
3. That computer and your monitors on **the same home network**.

---

## Install

### Step 1: Get AG2

Open a terminal (on Mac, **Terminal**; on Windows, **PowerShell**), then run:

```bash
git clone https://github.com/prezmc/ag2.git
cd ag2
```

> **No git?** On the [GitHub page](https://github.com/prezmc/ag2), click the green
> **Code** button → **Download ZIP**, unzip it, and open a terminal in the unzipped
> `ag2` folder.

### Step 2: Start AG2

```bash
docker compose up -d
```

The first start builds AG2 on your computer, which takes **3–5 minutes** (longer on a
Raspberry Pi). After that, it starts in seconds and restarts on its own after a reboot.

### Step 3: Open the dashboard

In a browser, go to **http://localhost:3000** on the same computer, or
**http://COMPUTER-IP:3000** from a phone or another computer.

### Step 4: Add your monitor

1. Click **⚙ Settings → + Add Monitor**.
2. Type the monitor's IP address, for example `192.168.1.50`, and click **Test**.
   You should see "✓ Connected" along with its model.
3. Choose **Indoor** or **Outdoor**, then click **Add Monitor**.

Readings appear within about 30 seconds. Repeat for each monitor you have.

**That's it. Nothing else needs to be set up.**

---

## Everyday commands

Run these from the `ag2` folder:

| To… | Run |
|---|---|
| Stop AG2 (data is kept) | `docker compose down` |
| Start it again | `docker compose up -d` |
| Update to the newest version | `git pull && docker compose up -d --build` |
| See what it's doing | `docker compose logs -f app` |

Installed from a ZIP? To update, download a new ZIP, unzip it over the old folder, then
run `docker compose up -d --build`. Your data is kept.

---

## Optional settings

Nothing has to be configured. To change a setting:

```bash
cp .env.example .env      # Windows PowerShell: copy .env.example .env
```

Open `.env` in any text editor, change the value, save, then run `docker compose up -d`.

| Setting | Default | What it does |
|---|---|---|
| `AG2_PORT` | `3000` | The port for the dashboard. Change it if 3000 is already in use. |
| `AG2_API_KEY` | off | Requires a key for API calls from other programs. The dashboard never needs it. |

### About the database password

**There's nothing to do.** On the first start, AG2 creates a random password for its
database, unique to your install, and keeps it inside Docker. You never need to see or
type it. The database is only reachable by AG2, never from your network or the internet.

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
Run `docker compose ps`. `app` and `db` should show "running" or "healthy" (`init` is a
one-time step and shows "exited", which is normal). If not, run `docker compose logs app`
to see what went wrong.

**The first start failed partway through the build**
Usually a network hiccup while downloading. Run `docker compose up -d --build` again.

**Start over completely (deletes all history and monitors)**

```bash
docker compose down -v
docker compose up -d
```

---

## Synology / Unraid / Portainer

- **Portainer:** *Stacks → Add stack → Repository*. Repository URL
  `https://github.com/prezmc/ag2`, compose path `docker-compose.yml`, then **Deploy**.
  Portainer builds AG2 from GitHub. No settings are needed.
- **Synology (Container Manager):** download the ZIP, copy the unzipped `ag2` folder to
  your NAS, then *Project → Create*, choose that folder, and use its existing
  `docker-compose.yml`.
- **Unraid (Compose Manager):** add a new stack pointing at the unzipped `ag2` folder.

To change the port, add an `AG2_PORT` environment variable in that screen.

---

## Moving an older install to this version

Only if you ran AG2 **before version 2.1**, when it was installed with
`docker run … setup` and a downloaded image. Your history and monitors are kept.

1. In your old `ag2` folder, note the database password:
   - If there's a `.env` file with a `DB_PASSWORD=` line, use that value.
   - Otherwise it's the old default, `ag2-local-db`.
2. Stop the old install: `docker compose down`
3. Get the new version (`git clone https://github.com/prezmc/ag2.git`, or the ZIP) into a
   new folder. Copy your old `.env` across if you had one. Your data lives in Docker, not in
   the folder, so it carries over.
4. In the new `ag2` folder, create `.env` (or add to it) with the password from step 1:
   ```
   DB_PASSWORD=ag2-local-db
   ```
5. Run `docker compose up -d`. AG2 saves that password once, and you can then delete the
   `DB_PASSWORD` line.

If the logs say "The database rejected the password", the value in step 4 didn't match.
Correct it, then run `docker compose down`, `docker volume rm ag2_secrets` and
`docker compose up -d`.

---

## Is it safe to open to the internet?

AG2 has no login screen. Use it on your home network. To see it while away, use a VPN
(such as Tailscale or WireGuard) rather than forwarding a port on your router.
