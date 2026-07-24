#!/usr/bin/env bash
# Builds the apps/web Docker image and asserts the standalone Next.js server
# boots and serves the home page.
#
# Usage: scripts/docker/smoke-test-web.sh
# Requires: Docker.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

image_tag="agu-web-smoke-test:local"
container_name="agu-web-smoke-test"
port=8081

cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Building apps/web Docker image"
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001 \
  -t "$image_tag" .

echo "==> Starting container"
docker run -d --name "$container_name" -p "${port}:8080" "$image_tag"

echo "==> Waiting for /"
attempts=30
until status=$(curl -s -o /tmp/agu-web-home.html -w '%{http_code}' "http://localhost:${port}/" 2>/dev/null); do
  attempts=$((attempts - 1))
  if [ "$attempts" -le 0 ]; then
    echo "FAIL: web server never responded" >&2
    docker logs "$container_name" >&2 || true
    exit 1
  fi
  sleep 1
done

if [ "$status" != "200" ]; then
  echo "FAIL: expected HTTP 200 from /, got ${status}" >&2
  docker logs "$container_name" >&2 || true
  exit 1
fi

echo "==> PASS: Web container smoke test succeeded (HTTP ${status})"
