#!/usr/bin/env bash
# Proves the full stack works inside the linux/amd64 container, including with no network.
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE=epsilab-salesforce:latest
# Its own compose project and host ports, so the smoke run never stops or resets a running dev stack.
COMPOSE=(docker compose -p epsilab-smoke)
export GUI_PORT=${SMOKE_GUI_PORT:-3300} API_PORT=${SMOKE_API_PORT:-8380}
GUI=http://localhost:$GUI_PORT
API=http://localhost:$API_PORT
OFFLINE=epsilab-smoke-offline
ENVCHECK=epsilab-smoke-env

cleanup() {
  "${COMPOSE[@]}" down --remove-orphans >/dev/null 2>&1 || true
  docker rm -f "$OFFLINE" "$ENVCHECK" >/dev/null 2>&1 || true
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
"${COMPOSE[@]}" build >/dev/null
echo "arch: $(docker image inspect "$IMAGE" --format '{{.Os}}/{{.Architecture}}')"
[ "$(docker image inspect "$IMAGE" --format '{{.Architecture}}')" = "amd64" ]

echo "== compose up"
"${COMPOSE[@]}" up -d >/dev/null
wait_for $API/api/health
wait_for $GUI/

echo "== REST: $(curl -fsS $API/api/health)"
echo "== REST All Leads Hot: $(curl -fsS -H 'content-type: application/json' -d '{"object":"Lead","where":[{"field":"IsConverted","op":"eq","value":false},{"field":"Rating","op":"eq","value":"Hot"}],"orderBy":[{"field":"Company"}],"limit":1}' $API/api/query | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).totalSize))')"
echo "== MCP:  $(npx tsx tests/smoke/mcp-check.ts $API/mcp)"

echo "== GUI (Playwright)"
BASE_URL=$GUI API_URL=$API npx playwright test --reporter=line

echo "== reset CLI inside the container (after the browser tests' edits)"
"${COMPOSE[@]}" exec -T app node dist/server/scripts/reset.js | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);console.log(`reset ${r.snapshot}: matches=${r.matches} in ${r.durationMs} ms`);process.exit(r.matches?0:1)})'

"${COMPOSE[@]}" down >/dev/null

echo "== offline (--network none)"
docker run -d --name "$OFFLINE" --network none "$IMAGE" >/dev/null
for _ in $(seq 1 30); do
  if docker exec "$OFFLINE" node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" 2>/dev/null; then break; fi
  sleep 1
done
docker exec -i "$OFFLINE" node --input-type=module - < tests/smoke/offline-check.mjs
docker exec -i "$OFFLINE" node --input-type=module - < tests/smoke/lifecycle-check.mjs

echo "== environment configuration (other ports, SEED_PROFILE=small, fixed CLOCK)"
docker run -d --name "$ENVCHECK" -p 4100:4100 -p 9180:9180 \
  -e GUI_PORT=4100 -e API_PORT=9180 -e SEED_PROFILE=small -e CLOCK=2029-03-01T10:00:00Z -e CLOCK_MODE=fixed \
  "$IMAGE" >/dev/null
wait_for http://localhost:9180/api/health
wait_for http://localhost:4100/
node tests/smoke/env-check.mjs "$(docker exec "$ENVCHECK" cat /app/data/snapshots/baseline-small.db.sha256 | tr -d '[:space:]')"

echo "SMOKE PASSED"
