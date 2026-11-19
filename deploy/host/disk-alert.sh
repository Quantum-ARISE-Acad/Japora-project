#!/usr/bin/env bash
# Alerte e-mail quand un disque se remplit. Tourne sur la VM elle-même (minuteur
# systemd), en dehors de Docker : elle prévient même si Japora est arrêté parce
# que l'espace est plein.
#
# Surveille / (le système) et /srv/japora-data (Docker et sauvegardes) :
#   - à partir de WARN_PCT % (80 par défaut) : e-mail « Attention » ;
#   - à partir de CRIT_PCT % (90 par défaut) : e-mail « URGENT » ;
#   - rappel toutes les REMIND_HOURS heures (12) tant que ça reste plein ;
#   - un e-mail quand l'espace redevient normal.
# Réglages et identifiants SMTP : /etc/japora/alerts.env (modèle dans
# deploy/host/alerts.env.example). Test : sudo /usr/local/sbin/japora-disk-alert --test
set -uo pipefail

CONF="${JAPORA_ALERT_CONF:-/etc/japora/alerts.env}"
STATE_DIR="${JAPORA_ALERT_STATE:-/var/lib/japora-alerts}"
WARN_PCT=80
CRIT_PCT=90
REMIND_HOURS=12
MOUNTS="/ /srv/japora-data"
SMTP_URL="" SMTP_USER="" SMTP_PASSWORD="" ALERT_EMAIL_FROM="" ALERT_EMAIL_TO=""
# shellcheck disable=SC1090
[ -r "$CONF" ] && . "$CONF"

HOST="$(hostname)"
mkdir -p "$STATE_DIR"

log() { logger -t japora-disk-alert -- "$*"; echo "$*"; }

send_mail() {
  local subject="$1" body="$2"
  if [ -z "$SMTP_URL" ] || [ -z "$ALERT_EMAIL_TO" ] || [ -z "$ALERT_EMAIL_FROM" ]; then
    log "E-mail non configuré ($CONF) — alerte non envoyée : $subject"
    return 1
  fi
  local msg rcpt_args=()
  local IFS=','
  for r in $ALERT_EMAIL_TO; do rcpt_args+=(--mail-rcpt "$(echo "$r" | xargs)"); done
  unset IFS
  msg="$(printf 'From: Japora %s <%s>\r\nTo: %s\r\nSubject: %s\r\nDate: %s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s\r\n' \
    "$HOST" "$ALERT_EMAIL_FROM" "$ALERT_EMAIL_TO" "$subject" "$(date -R)" "$body")"
  # Les identifiants passent par un fichier temporaire, jamais par la ligne de commande
  # (visible de tous dans la liste des processus).
  local auth; auth="$(mktemp)"; chmod 600 "$auth"
  local creds="${SMTP_USER}:${SMTP_PASSWORD}"
  creds="${creds//\\/\\\\}"; creds="${creds//\"/\\\"}"
  printf 'user = "%s"\n' "$creds" > "$auth"
  if printf '%s' "$msg" | curl -sS --max-time 30 --ssl-reqd --url "$SMTP_URL" -K "$auth" \
      --mail-from "$ALERT_EMAIL_FROM" "${rcpt_args[@]}" --upload-file - ; then
    log "E-mail envoyé : $subject"; rm -f "$auth"; return 0
  fi
  rm -f "$auth"; log "ÉCHEC de l'envoi de l'e-mail : $subject"; return 1
}

details() {
  echo "Espace disque sur $HOST :"
  df -h / /srv/japora-data 2>/dev/null
  echo
  if command -v docker >/dev/null; then
    echo "Docker :"; timeout 20 docker system df 2>/dev/null || echo "(Docker ne répond pas)"
    echo
  fi
  echo "Que faire :"
  echo " - nettoyer Docker : docker builder prune -f && docker image prune -f"
  echo " - vérifier les sauvegardes : du -sh ~/japora/backups/* | sort -h | tail"
  echo " - agrandir le disque de Japora : voir deploy/README.md, « Espace disque »."
}

if [ "${1:-}" = "--test" ]; then
  send_mail "[Japora $HOST] Test de l'alerte disque" "Ceci est un test : les alertes disque de la VM $HOST arrivent bien à cette adresse.

$(details)"
  exit $?
fi

now=$(date +%s)
for m in $MOUNTS; do
  mountpoint -q "$m" || continue
  pct=$(df --output=pcent "$m" | tail -1 | tr -dc '0-9')
  key="$STATE_DIR/$(echo "$m" | tr '/' '_')"
  prev_level="$(cut -d' ' -f1 "$key" 2>/dev/null || echo ok)"
  last_sent="$(cut -d' ' -f2 "$key" 2>/dev/null || echo 0)"
  if (( pct >= CRIT_PCT )); then level=crit; elif (( pct >= WARN_PCT )); then level=warn; else level=ok; fi
  name="$m"; [ "$m" = / ] && name="/ (système)"; [ "$m" = /srv/japora-data ] && name="/srv/japora-data (Docker et sauvegardes)"

  should_send=0
  if [ "$level" != "$prev_level" ]; then
    should_send=1
  elif [ "$level" != ok ] && (( now - last_sent >= REMIND_HOURS * 3600 )); then
    should_send=1
  fi
  (( should_send )) || continue

  case "$level" in
    crit) subject="[Japora $HOST] URGENT : disque $name plein à ${pct} %" ;;
    warn) subject="[Japora $HOST] Attention : disque $name rempli à ${pct} %" ;;
    ok)   subject="[Japora $HOST] Disque $name revenu à ${pct} %" ;;
  esac
  if send_mail "$subject" "$(details)"; then
    echo "$level $now" > "$key"
  else
    # E-mail impossible : on garde l'ancien état pour réessayer au prochain passage.
    log "$subject"
  fi
done
