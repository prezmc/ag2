#!/bin/sh
# Make sure the mounted data directory is writable by the unprivileged user,
# then drop root and start the server.
mkdir -p /app/data
chown -R nextjs:nodejs /app/data
exec su-exec nextjs node server.js
