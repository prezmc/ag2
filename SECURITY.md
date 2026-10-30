# Security

## Reporting a vulnerability

Please report security problems privately using GitHub's
**Security → Report a vulnerability** button on this repository rather than
opening a public issue. Include what you found, how to reproduce it, and the
AG2 version (shown in the dashboard footer).

## Security model

AG2 is designed to run on a **trusted home network**.

- **No login screen.** Anyone who can reach the dashboard can view readings and
  add or remove monitors. Don't expose it directly to the internet: use a VPN
  (Tailscale, WireGuard) or an authenticating proxy (e.g. Cloudflare Access).
- **Cross-site protection is always on.** Other websites can't make your browser
  change AG2's settings (requests that change data must come from AG2's own
  pages and be JSON).
- **Optional API key.** Set `AG2_API_KEY` to require an `X-API-Key` header for
  API calls that don't come from the dashboard itself.
- **Monitor addresses are restricted** to private IPv4 ranges (10.x, 172.16–31.x,
  192.168.x). Hostnames, public IPs, link-local/cloud-metadata addresses and
  redirects are refused, requests time out after 10 s, and only known
  measurement fields are kept from a monitor's response.
- **Database** is only reachable inside the Docker network; it is never
  published to your LAN. The `setup` command gives every install its own random
  database password (in `.env`). If you deploy without `.env` (e.g. Portainer),
  set `DB_PASSWORD` yourself; otherwise the public default `ag2-local-db` is used.
- **Container** runs the app as an unprivileged user.

## Keeping up to date

```bash
docker compose pull && docker compose up -d
```
