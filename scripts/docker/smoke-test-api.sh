#!/usr/bin/env bash
# Builds the apps/api "api" Docker target, runs it standalone (no Cloud SQL,
# no Postgres) and asserts the process boots and /health responds. This is a
# process/port smoke test, not a full readiness test — /ready needs a real
# database and is intentionally not checked here.
#
# Usage: scripts/docker/smoke-test-api.sh
# Requires: Docker.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

image_tag="agu-api-smoke-test:local"
container_name="agu-api-smoke-test"
port=8080

cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Building apps/api Docker image (target: api)"
docker build -f apps/api/Dockerfile --target api -t "$image_tag" .

echo "==> Starting container"
# DATABASE_URL is required at process boot (PrismaService throws without it)
# but doesn't need to be reachable for this smoke test: only /health (pure
# liveness, no DB call) is checked, never /ready.
docker run -d --name "$container_name" \
  -p "${port}:8080" \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://smoke:smoke@localhost:5432/smoke?schema=public" \
  -e AUTH_SESSION_SECRET="smoke-test-session-secret-not-for-real-use-000000" \
  -e QR_ATTENDANCE_SECRET="smoke-test-qr-secret-not-for-real-use-000000000" \
  -e WEB_ORIGIN="http://localhost:3000" \
  -e ENABLE_DEV_AUTH=false \
  -e ENABLE_EMAIL_AUTH=false \
  -e EMAIL_DELIVERY_MODE=smtp \
  "$image_tag"

echo "==> Waiting for /health"
attempts=30
until curl -fsS "http://localhost:${port}/health" >/tmp/agu-api-health.json 2>/dev/null; do
  attempts=$((attempts - 1))
  if [ "$attempts" -le 0 ]; then
    echo "FAIL: /health never responded" >&2
    docker logs "$container_name" >&2 || true
    exit 1
  fi
  sleep 1
done

echo "==> /health response:"
cat /tmp/agu-api-health.json
echo

if ! grep -q '"status":"ok"' /tmp/agu-api-health.json; then
  echo "FAIL: /health did not report status ok" >&2
  exit 1
fi

echo "==> PASS: API container smoke test succeeded"
