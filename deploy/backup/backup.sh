#!/bin/sh
# Sauvegarde la base et les photos toutes les 6 heures.
#   backup.sh         : tourne en continu (service Docker)
#   backup.sh --once  : une seule sauvegarde, puis s'arrête
# Un fichier n'apparaît sous son nom final qu'une fois vérifié : un .dump présent est lisible.
set -u

BACKUP_DIR=/backups
INTERVAL="${BACKUP_INTERVAL_SECONDS:-21600}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
OWNER="${BACKUP_OWNER:-0:0}"
METRICS=/metrics/wataru_backup.prom

log() { echo "[$(date -u +%FT%TZ)] $*"; }

backup_once() {
  stamp=$(date -u +%Y%m%d-%H%M%S)
  umask 077
  work="$BACKUP_DIR/.work-$stamp-$$"
  mkdir -p "$work" || return 1

  pg_dump -Fc -f "$work/japora.dump" || { log "ECHEC pg_dump"; rm -rf "$work"; return 1; }
  pg_restore --list "$work/japora.dump" >/dev/null || { log "ECHEC dump illisible"; rm -rf "$work"; return 1; }
  tar -C /data/uploads -czf "$work/uploads.tar.gz" . || { log "ECHEC photos"; rm -rf "$work"; return 1; }

  final="$BACKUP_DIR/japora-$stamp"
  # Deux sauvegardes dans la même seconde ne doivent pas s'imbriquer.
  [ ! -e "$final" ] || final="$final-$$"
  mv "$work" "$final"
  chown -R "$OWNER" "$final"
  find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'japora-*' -mtime "+$KEEP_DAYS" -exec rm -rf {} +

  size=$(du -sb "$final" | cut -f1)
  now=$(date +%s)
  # Écriture atomique : node-exporter ne lit jamais un fichier à moitié écrit.
  printf 'wataru_backup_last_success_timestamp_seconds %s\nwataru_backup_last_size_bytes %s\n' "$now" "$size" > "$METRICS.tmp"
  chmod 644 "$METRICS.tmp"
  mv "$METRICS.tmp" "$METRICS"
  log "OK $(basename "$final") ($size octets)"
}

if [ "${1:-}" = "--once" ]; then
  backup_once
  exit $?
fi

log "Sauvegarde toutes les $INTERVAL secondes, conservation $KEEP_DAYS jours"
while :; do
  backup_once || log "Nouvel essai dans 5 minutes"
  if [ -f "$METRICS" ] && [ $(( $(date +%s) - $(stat -c %Y "$METRICS") )) -lt 60 ]; then
    sleep "$INTERVAL"
  else
    sleep 300
  fi
done
