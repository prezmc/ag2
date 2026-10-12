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
    for f in docker-compose.yml .env.example INSTALL.md; do
      if [ -e "/out/$f" ]; then
        echo "  kept      $f (already exists — not overwritten)"
      else
        cp "/app/deploy/$f" "/out/$f"
        chown "$owner" "/out/$f" 2>/dev/null || true
        echo "  created   $f"
      fi
    done
    cat <<'MSG'

AG2 setup files are ready. Next:

  1. docker compose up -d
  2. Open http://localhost:3000  (or http://<this-computer's-IP>:3000)
  3. Settings → Add Monitor → enter your AirGradient's IP → Test → Add

Optional settings: copy .env.example to .env and edit it.
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
