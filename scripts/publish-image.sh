#!/bin/sh
# Build a multi-arch AG2 image and push it to Docker Hub.
# Usage:  sh scripts/publish-image.sh            (pushes :latest and :<package.json version>)
#         IMAGE=youruser/ag2 sh scripts/publish-image.sh
set -e
cd "$(dirname "$0")/.."
IMAGE="${IMAGE:-prezmcmahon/ag2}"
VERSION="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' package.json | head -1)"
# Stamp the image with its version and git commit ourselves; turn off buildx's
# own git probe, which only prints a warning when it can't read the repo.
REVISION="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
export BUILDX_GIT_INFO=0

docker info >/dev/null 2>&1 || { echo "Docker isn't running — start Docker Desktop and retry."; exit 1; }
docker buildx inspect ag2-builder >/dev/null 2>&1 || docker buildx create --name ag2-builder --use >/dev/null
docker buildx use ag2-builder

echo "Building $IMAGE:latest and $IMAGE:$VERSION for linux/amd64 + linux/arm64…"
docker buildx build --platform linux/amd64,linux/arm64 \
  --label "org.opencontainers.image.title=AirGradient Local (AG2)" \
  --label "org.opencontainers.image.version=$VERSION" \
  --label "org.opencontainers.image.revision=$REVISION" \
  --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -t "$IMAGE:latest" -t "$IMAGE:$VERSION" --push .
echo "Pushed $IMAGE:latest and $IMAGE:$VERSION (commit $REVISION)"
