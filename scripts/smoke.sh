#!/usr/bin/env bash
# Proves the full stack works inside the linux/amd64 container, including with no network.
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE=epsilab-salesforce:latest
OFFLINE=epsilab-smoke-offline

cleanup() {
  docker compose down --remove-orphans >/dev/null 2>&1 || true
  docker rm -f "$OFFLINE" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

wait_for() {
  for _ in $(seq 1 30); do
    if curl -fsS "$1" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "timed out waiting for $1" >&2
  return 1
}

echo "== build"
docker compose build >/dev/null
echo "arch: $(docker image inspect "$IMAGE" --format '{{.Os}}/{{.Architecture}}')"
[ "$(docker image inspect "$IMAGE" --format '{{.Architecture}}')" = "amd64" ]

echo "== compose up"
docker compose up -d >/dev/null
wait_for http://localhost:8080/api/health
wait_for http://localhost:3000/

echo "== REST: $(curl -fsS http://localhost:8080/api/health)"
echo "== MCP:  $(npx tsx tests/smoke/mcp-check.ts http://localhost:8080/mcp)"

echo "== GUI (Playwright)"
BASE_URL=http://localhost:3000 npx playwright test --reporter=line

docker compose down >/dev/null

echo "== offline (--network none)"
docker run -d --name "$OFFLINE" --network none "$IMAGE" >/dev/null
for _ in $(seq 1 30); do
  if docker exec "$OFFLINE" node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" 2>/dev/null; then break; fi
  sleep 1
done
docker exec -i "$OFFLINE" node --input-type=module - < tests/smoke/offline-check.mjs

echo "SMOKE PASSED"
