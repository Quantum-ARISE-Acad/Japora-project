#!/bin/sh
# Remplace les crons de vercel.json : sans ça, rien ne relance les messages WhatsApp
# en échec, ni ne purge les codes expirés.
call() {
  if wget -qO- --header="X-Cron-Key: $CRON_SECRET" "http://wcatalog:5174$1" >/dev/null 2>&1; then
    echo "[$(date -u +%FT%TZ)] OK $1"
  else
    echo "[$(date -u +%FT%TZ)] ECHEC $1"
  fi
}

echo "Planificateur : diffusions chaque minute, maintenance chaque heure, résumé à 18:00 UTC"
while :; do
  now=$(date -u +%s)
  sleep $(( 60 - now % 60 ))
  # Capture the tick before network calls so a slow broadcast does not skip the hour.
  minute=$(date -u +%M)
  hour=$(date -u +%H)
  call /api/cron/broadcasts
  if [ "$minute" = "00" ]; then
    call /api/cron/maintenance
    [ "$hour" = "18" ] && call /api/cron/daily-summary
  fi
done
