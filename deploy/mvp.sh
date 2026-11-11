#!/usr/bin/env bash
# Commandes du déploiement MVP. Voir deploy/README.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

secret() { openssl rand -hex 32; }

dc() {
  [ -f .env.mvp ] || { echo "Il manque .env.mvp : lancez d'abord  deploy/mvp.sh init <domaine> <email>" >&2; exit 1; }
  [ -f .env.keys ] || { touch .env.keys; chmod 600 .env.keys; }
  docker compose --env-file .env.mvp --env-file .env.keys -f docker-compose.mvp.yml "$@"
}

init() {
  local domain="${1:-}" email="${2:-}"
  [ -n "$domain" ] && [ -n "$email" ] || { echo "Usage : deploy/mvp.sh init <domaine> <email>" >&2; exit 1; }
  # Écraser ce fichier changerait tous les secrets et couperait l'accès à la base.
  [ ! -e .env.mvp ] || { echo ".env.mvp existe déjà : je n'y touche pas." >&2; exit 1; }
  local grafana_password; grafana_password="$(secret)"
  (
    umask 077
    cat > .env.mvp <<ENV
DOMAIN=$domain
ACME_EMAIL=$email
PUBLIC_URL=https://$domain
GRAFANA_PUBLIC_URL=https://grafana.$domain
POSTGRES_PASSWORD=$(secret)
SESSION_SECRET=$(secret)
WATARU_UNIFIED_AUTH_SECRET=$(secret)
CRON_SECRET=$(secret)
GRAFANA_ADMIN_PASSWORD=$grafana_password
BACKUP_OWNER=$(id -u):$(id -g)
BACKUP_INTERVAL_SECONDS=21600
BACKUP_KEEP_DAYS=7
JAPORA_ENABLE_DEV_PAY_STUB=
ENV
  )
  [ -f .env.keys ] || { (umask 077; touch .env.keys); }
  mkdir -p backups
  echo ".env.mvp créé. Rangez une copie dans le coffre-fort de l'équipe (Bitwarden)."
  echo "Mettez les clés des services (Clerk, Meta, Gemini...) dans .env.keys (modèle : .env.example), puis : deploy/mvp.sh up"
}

check_schema() {
  # Empêche de déployer un schéma modifié sans migration : Japora planterait devant les visiteurs.
  dc exec -T postgres sh -c 'psql -U japora -d japora -tc "SELECT 1 FROM pg_database WHERE datname='"'"'japora_shadow'"'"'" | grep -q 1 || createdb -U japora japora_shadow'
  dc run --rm --no-deps -T --entrypoint sh wcatalog -c \
    'npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "${DATABASE_URL%/*}/japora_shadow" --exit-code >/dev/null' \
    || { echo "ARRET : schema.prisma a changé sans migration. Rien n'a été remplacé." >&2; exit 1; }
  echo "Schéma et migrations concordent."
}

restore() {
  local dir="${1:-}"
  [ -n "$dir" ] && [ -f "$dir/japora.dump" ] || { echo "Usage : deploy/mvp.sh restore backups/japora-AAAAMMJJ-HHMMSS" >&2; exit 1; }
  echo "ATTENTION : la base et les photos actuelles seront remplacées par $dir."
  read -r -p "Tapez RESTAURER pour confirmer : " answer
  [ "$answer" = "RESTAURER" ] || { echo "Annulé."; exit 1; }
  echo "Sauvegarde de l'état actuel avant de le remplacer..."
  dc exec -T backup backup.sh --once
  dc stop wcatalog scheduler
  dc exec -T postgres pg_restore -U japora -d japora --clean --if-exists --no-owner < "$dir/japora.dump"
  dc run --rm --no-deps -T --user root --entrypoint sh wcatalog -c \
    'find public/uploads -mindepth 1 -delete && tar -xzf - -C public/uploads && chown -R node:node public/uploads' < "$dir/uploads.tar.gz"
  dc up -d wcatalog scheduler
  echo "Restauration terminée."
}

case "${1:-}" in
  init) shift; init "$@" ;;
  up) dc up -d --build --remove-orphans; dc ps ;;
  down) dc down ;;   # sans -v : les données sont conservées
  ps) dc ps ;;
  logs) shift; dc logs -f --tail=100 "$@" ;;
  backup) dc exec -T backup backup.sh --once ;;
  restore) shift; restore "$@" ;;
  check-schema) check_schema ;;
  update)
    git pull --ff-only
    dc build
    check_schema
    dc exec -T backup backup.sh --once
    dc up -d --remove-orphans
    dc ps
    ;;
  *)
    cat <<USAGE
Usage : deploy/mvp.sh <commande>
  init <domaine> <email>   Crée .env.mvp et génère les secrets (une seule fois)
  up                       Construit et démarre tout
  ps                       État des services
  logs [service]           Journaux en direct
  backup                   Sauvegarde immédiate
  restore <dossier>        Restaure une sauvegarde
  check-schema             Vérifie que le schéma a ses migrations
  update                   git pull, vérifie, sauvegarde, puis remplace
  down                     Arrête tout, sans effacer les données
USAGE
    exit 1
    ;;
esac
