# ── Stage 1: dependencies ────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk update && apk upgrade --no-cache
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN apk update && apk upgrade --no-cache
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Replace Next.js's vendored picomatch with the patched top-level copy (CVE fix),
# when one is installed. Applied before the build and again to the standalone output.
RUN if [ -f node_modules/picomatch/package.json ]; then \
      cp -r node_modules/picomatch/. node_modules/next/dist/compiled/picomatch/ ; \
    fi

RUN npm run build

RUN if [ -f node_modules/picomatch/package.json ] && [ -d .next/standalone/node_modules/next/dist/compiled/picomatch ]; then \
      cp -r node_modules/picomatch/. .next/standalone/node_modules/next/dist/compiled/picomatch/ ; \
    fi

# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk update && apk upgrade --no-cache && apk add --no-cache su-exec

# The runner only executes the pre-built server — drop npm and its bundled CVEs
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATA_DIR=/app/data \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs && \
    mkdir -p /app/data && chown -R nextjs:nodejs /app/data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --chmod=755 entrypoint.sh ./entrypoint.sh
# Install kit handed out by `docker run ... prezmcmahon/ag2 setup`
COPY deploy/ ./deploy/

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

ENTRYPOINT ["./entrypoint.sh"]
CMD ["start"]
