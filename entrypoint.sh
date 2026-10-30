#!/bin/sh
# AG2 container entrypoint.
#
#   start        (default) start the dashboard server
#   init-secret  first-run step: create the database password if it doesn't exist
#   help         print usage
#
# The database password lives in a small Docker volume shared by the app and
# the database (mounted at /run/ag2-secrets). It's generated once, at random,
# for each install — nobody has to choose, type or store it.
set -e

SECRET_DIR=/run/ag2-secrets
SECRET_FILE="$SECRET_DIR/db_password"

case "${1:-start}" in
  init-secret)
    if [ -s "$SECRET_FILE" ]; then
      echo "[init] Database password already set — keeping it."
      exit 0
    fi
    mkdir -p "$SECRET_DIR"
    umask 077
    if [ -n "$DB_PASSWORD" ]; then
      # Only for installs that already have a database with a known password
      case "$DB_PASSWORD" in
        *[!A-Za-z0-9._~-]*)
          echo "[init] DB_PASSWORD may only contain letters, numbers and . _ ~ -"
          exit 1 ;;
      esac
      printf '%s' "$DB_PASSWORD" > "$SECRET_FILE"
      echo "[init] Saved the database password from DB_PASSWORD."
    else
      od -A n -N 16 -t x1 /dev/urandom | tr -d ' \n' > "$SECRET_FILE"
      echo "[init] Created a random database password for this install."
    fi
    exit 0
    ;;
  help|--help|-h)
    sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  start) ;;
  *)
    echo "Unknown command: $1 (try: start, init-secret, help)"
    exit 1
    ;;
esac

# Build the database connection from the generated password, unless a full
# DATABASE_URL was given (e.g. an external database).
if [ -z "$DATABASE_URL" ]; then
  if [ ! -s "$SECRET_FILE" ]; then
    echo "[boot] No database password found in $SECRET_FILE. Start AG2 with 'docker compose up -d'."
    exit 1
  fi
  DATABASE_URL="postgresql://ag2:$(cat "$SECRET_FILE")@${DB_HOST:-db}:5432/ag2"
  export DATABASE_URL
fi

# Make sure the data folder is writable, then drop root.
mkdir -p /app/data
chown -R nextjs:nodejs /app/data
exec su-exec nextjs node server.js
