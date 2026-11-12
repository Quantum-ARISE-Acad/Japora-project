#!/usr/bin/env bash
# Uses disposable Compose resources only. Never invokes deploy/mvp.sh down,
# never mounts ./backups, and never reads .env or .env.keys.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
ROOT="$PWD"
export CI_APP_IMAGE="${CI_APP_IMAGE:-japora-ci-app:local}"
export CI_BACKUP_IMAGE="${CI_BACKUP_IMAGE:-japora-ci-backup:local}"
PROJECT="japora-ci-$(date +%s)-$$"
RESULTS="${CI_RESULTS_DIR:-$ROOT/ci-results}"
mkdir -p "$RESULTS"
RESULTS="$(cd "$RESULTS" && pwd)"
# Fail immediately on local directory permission issues, before starting Docker.
test -w "$RESULTS"
COMPOSE=(docker compose --env-file /dev/null -p "$PROJECT" -f "$ROOT/.github/ci/compose.yml")
dc() { "${COMPOSE[@]}" "$@"; }

cleanup() {
  local status=$?
  trap - EXIT
  dc ps -a > "$RESULTS/containers.log" 2>&1 || true
  dc logs --no-color > "$RESULTS/infrastructure.log" 2>&1 || true
  # Only this script's unique project can be removed, including its test data.
  dc down --volumes --remove-orphans --timeout 10 >> "$RESULTS/cleanup.log" 2>&1 || status=1
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

retry() {
  local attempt
  for attempt in {1..60}; do
    if "$@"; then return 0; fi
    echo "Waiting for $* ($attempt/60)..." >&2
    sleep 2
  done
  echo "Timed out: $*" >&2
  return 1
}

echo 'Starting isolated production images...'
dc config --quiet
dc up -d --wait --wait-timeout 180
test "$(dc exec -T wcatalog id -u)" != 0
test -z "$(docker port "$(dc ps -q postgres)")"
dc exec -T prometheus promtool check config /etc/prometheus/prometheus.yml

echo 'Checking migrations and schema parity against actual PostgreSQL...'
dc exec -T wcatalog npx --no-install prisma migrate status
dc exec -T wcatalog npx --no-install prisma migrate deploy
# A migrated DB must have exactly the structure expected by the generated client.
dc exec -T wcatalog sh -ec 'npx --no-install prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code'
dc exec -T wcatalog node - write < scripts/ci/postgres-fixture.cjs

port="$(dc port caddy 443)"
BASE="https://localhost:${port##*:}"
health() {
  curl --fail --silent --show-error --insecure --max-time 10 "$BASE/api/health" > "$RESULTS/health.json" || return 1
  node -e 'const a=require("node:assert/strict"),fs=require("node:fs");const h=JSON.parse(fs.readFileSync(process.argv[1]));a.equal(h.status,"ok");a.equal(h.db,"ok");' "$RESULTS/health.json"
}
echo 'Checking real HTTPS proxy, public catalog and unauthenticated access...'
# Local Caddy CA is trusted only for this test; public certificates need DNS.
retry health
curl --fail --silent --show-error --insecure --max-time 15 "$BASE/c/ci-shop" > "$RESULTS/catalog.html"
grep -q 'CI Product' "$RESULTS/catalog.html"
test "$(curl --silent --insecure --max-time 15 -o "$RESULTS/unauthorized.json" -w '%{http_code}' "$BASE/api/products")" = 401
test "$(curl --silent --insecure --max-time 15 -o /dev/null -w '%{http_code}' "$BASE/api/ecosystem/shops")" = 404
# Business counters are for Prometheus on the internal network only.
test "$(curl --silent --insecure --max-time 15 -o /dev/null -w '%{http_code}' "$BASE/api/metrics")" = 404
dc exec -T wcatalog sh -ec 'wget -qO- http://127.0.0.1:5174/api/metrics' > "$RESULTS/metrics.txt"
grep -q '^japora_metrics_up 1$' "$RESULTS/metrics.txt"
grep -q '^japora_orders_paid_total ' "$RESULTS/metrics.txt"
curl --silent --show-error --insecure --max-time 15 --dump-header "$RESULTS/headers.txt" -o /dev/null "$BASE/api/health"
grep -qi '^strict-transport-security:' "$RESULTS/headers.txt"
dc exec -T wcatalog sh -ec 'printf "ci-upload-persistence\n" > public/uploads/ci-proof.txt'
test "$(curl --fail --silent --show-error --insecure --max-time 10 "$BASE/uploads/ci-proof.txt")" = ci-upload-persistence
dc exec -T wcatalog node -e 'const fs=require("node:fs"),path=require("node:path");fs.writeFileSync(path.join(process.env.UPLOADS_DIR,"ci-photo.png"),Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=","base64"));'
# Verify both paths read the same persistent directory: Caddy bypasses Next.js
# for /uploads, whereas direct Next.js uses Ferdinand's rewrite/API handler.
dc exec -T wcatalog node - <<'JS'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const expected = fs.readFileSync(path.join(process.env.UPLOADS_DIR, 'ci-photo.png'));
  for (const url of ['http://localhost:5174/api/uploads/ci-photo.png', 'http://localhost:5174/uploads/ci-photo.png']) {
    const response = await fetch(url);
    assert.equal(response.status, 200, url);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
JS
curl --fail --silent --show-error --insecure --max-time 10 "$BASE/uploads/ci-photo.png" > "$RESULTS/ci-photo.png"
node -e 'const assert=require("node:assert/strict"),fs=require("node:fs");assert.equal(fs.readFileSync(process.argv[1]).toString("base64"),"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=");' "$RESULTS/ci-photo.png"

echo 'Checking broadcast scheduler endpoint authentication and queue processing...'
test "$(curl --silent --insecure --max-time 15 -o /dev/null -w '%{http_code}' "$BASE/api/cron/broadcasts")" = 401
curl --fail --silent --show-error --insecure --max-time 15 -H 'X-Cron-Key: ci-only-broadcast-cron-secret' "$BASE/api/cron/broadcasts" > "$RESULTS/broadcast-cron.json"
node -e 'const a=require("node:assert/strict"),fs=require("node:fs");const r=JSON.parse(fs.readFileSync(process.argv[1]));a.equal(r.ok,true);a.equal(r.processed,0);a.equal(r.uncertain,0);' "$RESULTS/broadcast-cron.json"

echo 'Checking scheduled backup, manual backup and restore into a separate database...'
# Stop the scheduler after proving two automatic runs; manual backup then has
# exclusive access, so dump/photo comparisons cannot race with rotation.
scheduled_backups() {
  local count
  count="$(dc exec -T backup sh -ec 'find /backups -mindepth 1 -maxdepth 1 -type d -name "japora-*" | wc -l')"
  test "$count" -ge 2
}
retry scheduled_backups
dc stop backup
dc run --rm --no-deps -T backup --once
dc exec -T postgres createdb -U japora japora_restore
dc run --rm --no-deps -T --entrypoint sh backup -ec '
  latest=$(find /backups -mindepth 1 -maxdepth 1 -type d -name "japora-*" | sort | tail -n 1)
  test -s "$latest/japora.dump"
  pg_restore --list "$latest/japora.dump" >/dev/null
  pg_restore --exit-on-error --no-owner --dbname=japora_restore "$latest/japora.dump"
  mkdir /tmp/restored-uploads
  tar -xzf "$latest/uploads.tar.gz" -C /tmp/restored-uploads
  test "$(cat /tmp/restored-uploads/ci-proof.txt)" = ci-upload-persistence
  grep -q "^wataru_backup_last_success_timestamp_seconds " /metrics/wataru_backup.prom
'
dc exec -T -e DATABASE_URL=postgresql://japora:ci-only-postgres-password@postgres:5432/japora_restore wcatalog node - check < scripts/ci/postgres-fixture.cjs

echo 'Checking persistence after removing and recreating application and database containers...'
dc stop wcatalog postgres
dc rm -f wcatalog postgres
dc up -d --wait --wait-timeout 180 wcatalog
dc exec -T wcatalog node - check < scripts/ci/postgres-fixture.cjs
retry health
test "$(curl --fail --silent --show-error --insecure --max-time 10 "$BASE/uploads/ci-proof.txt")" = ci-upload-persistence

echo 'Checking Prometheus scraping and Grafana dashboard provisioning...'
monitoring() {
  dc exec -T wcatalog node - <<'JS'
const assert = require('node:assert/strict');
async function json(url, options) {
  const r = await fetch(url, {...options, signal: AbortSignal.timeout(10000)});
  assert.equal(r.status, 200, url);
  return r.json();
}
(async () => {
  for (const query of ['pg_up', 'probe_success{job="japora-health"}', 'up{job="caddy"}', 'up{job="japora"}', 'japora_metrics_up']) {
    const result = await json('http://prometheus:9090/api/v1/query?query=' + encodeURIComponent(query));
    assert.equal(result.status, 'success');
    assert.ok(result.data.result.length > 0, query);
    assert.ok(result.data.result.every(row => Number(row.value[1]) === 1), query);
  }
  const auth = {headers: {Authorization: 'Basic ' + Buffer.from('admin:ci-only-grafana-password').toString('base64')}};
  const health = await json('http://grafana:3000/api/health');
  assert.equal(health.database, 'ok');
  const dashboards = await json('http://grafana:3000/api/search?type=dash-db', auth);
  assert.ok(dashboards.some(d => d.title === 'Japora — Foire de Lomé'), 'Stand dashboard provisioned');
  const source = await json('http://grafana:3000/api/datasources/uid/prometheus/health', auth);
  assert.equal(source.status, 'OK', 'Grafana can query Prometheus');
})().catch(e => { console.error(e); process.exitCode = 1; });
JS
}
retry monitoring
echo 'All infrastructure checks passed.' | tee "$RESULTS/infrastructure-summary.txt"
