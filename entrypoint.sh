#!/bin/sh
# AG2 container entrypoint.
#
#   (default)  start the dashboard server
#   setup      copy the install kit (docker-compose.yml, .env.example, INSTALL.md)
#              into /out — mount your folder there:
#                docker run --rm -v "$PWD:/out" prezmcmahon/ag2 setup
#   help       print usage
set -e

case "$1" in
  setup)
    if [ ! -d /out ]; then
      echo "Mount the folder to copy into at /out, e.g.:"
      echo '  docker run --rm -v "$PWD:/out" prezmcmahon/ag2 setup'
      exit 1
    fi
    owner="$(stat -c '%u:%g' /out 2>/dev/null || echo 0:0)"

    # A folder with no docker-compose.yml and no .env is a brand-new install:
    # give it its own random database password. (Never touch an existing
    # install, whose database already has a password set.)
    fresh=no
    [ ! -e /out/docker-compose.yml ] && [ ! -e /out/.env ] && fresh=yes

    for f in docker-compose.yml .env.example INSTALL.md; do
      if [ -e "/out/$f" ]; then
        echo "  kept      $f (already exists — not overwritten)"
      else
        cp "/app/deploy/$f" "/out/$f"
        chown "$owner" "/out/$f" 2>/dev/null || true
        echo "  created   $f"
      fi
    done

    if [ "$fresh" = yes ]; then
      pw="$(od -A n -N 16 -t x1 /dev/urandom | tr -d ' \n')"
      sed "s/^DB_PASSWORD=.*/DB_PASSWORD=$pw/" /app/deploy/.env.example > /out/.env
      chmod 600 /out/.env
      chown "$owner" /out/.env 2>/dev/null || true
      echo "  created   .env (with a random database password just for this install)"
    elif [ -e /out/.env ]; then
      echo "  kept      .env (already exists — not overwritten)"
    else
      echo "  skipped   .env (existing install — it keeps its current database password)"
    fi

    cat <<'MSG'

AG2 setup files are ready. Next:

  1. docker compose up -d
  2. Open http://localhost:3000  (or http://<this-computer's-IP>:3000)
  3. Settings → Add Monitor → enter your AirGradient's IP → Test → Add

Settings (port, password, version) are in .env — all optional.
Full guide: INSTALL.md
MSG
    exit 0
    ;;
  help|--help|-h)
    sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
esac

# Normal start: make sure the data folder is writable, then drop root.
mkdir -p /app/data
chown -R nextjs:nodejs /app/data
exec su-exec nextjs node server.js
