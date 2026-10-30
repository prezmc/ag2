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

This puts four files in the new `ag2` folder:

| File | What it is |
|---|---|
| `docker-compose.yml` | Tells Docker what to run. You don't need to edit it. |
| `.env` | Your settings, including a **random database password created just for you**. Nothing to edit. |
| `.env.example` | A blank copy of the settings with explanations, for reference. |
| `INSTALL.md` | This guide. |

> **Keep `.env` private and don't delete it.** It holds your database password.
> (Files that start with a dot are hidden by default: on a Mac press
> Cmd+Shift+. in Finder to show them.)

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

Nothing has to be configured. Your settings live in `.env`. To change one, open
`.env` in any text editor, change the value, save, then run `docker compose up -d`.

The most common change is **port 3000 already in use**: set `AG2_PORT=3001`, or any free
port, and open the dashboard on that port instead.

### About the database password

- **You don't need to know or type it.** The setup command put a random one in `.env`,
  and AG2 uses it automatically.
- **It never leaves your computer.** The database is only reachable by AG2 inside Docker,
  not from your network or the internet.
- **Don't change it in `.env` after the first start.** The password is set when the
  database is created; editing `.env` later only changes what AG2 *sends*, so AG2 can't
  connect. To change it properly, see below.
- **No `.env`?** (For example, you pasted the Compose file into Portainer.) AG2 then
  falls back to a built-in default password, `ag2-local-db`. That works, but everyone
  knows it, so set your own `DB_PASSWORD` before the first start (see the bottom of this
  page).

### Changing the database password

Run these from the `ag2` folder, replacing `NEWPASSWORD` (letters and numbers only):

```bash
docker compose exec db psql -U ag2 -d ag2 -c "ALTER USER ag2 PASSWORD 'NEWPASSWORD';"
```

Then set `DB_PASSWORD=NEWPASSWORD` in `.env` and run `docker compose up -d`.
Your history is kept.

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

**Logs say "The database rejected the password"**
`DB_PASSWORD` in `.env` was changed (or `.env` was replaced) after the first start. Put the
original value back, or follow "Changing the database password" above.

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
Container Manager) and paste the contents of `docker-compose.yml`.

**Before you deploy it**, add an environment variable named `DB_PASSWORD` with a
password of your own (letters and numbers only, e.g. from `openssl rand -hex 16`).
Without it, AG2 uses the built-in default password that everyone knows. Add
`AG2_PORT` the same way if you need a different port.

---

## Is it safe to open to the internet?

AG2 has no login screen. Use it on your home network. To see it while away, use a VPN
(such as Tailscale or WireGuard) rather than forwarding a port on your router.
