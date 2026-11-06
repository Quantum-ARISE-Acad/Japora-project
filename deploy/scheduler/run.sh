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

echo "Planificateur : maintenance à chaque heure, résumé quotidien à 18:00 UTC"
while :; do
  now=$(date -u +%s)
  sleep $(( 3600 - now % 3600 ))
  call /api/cron/maintenance
  [ "$(date -u +%H)" = "18" ] && call /api/cron/daily-summary
done
