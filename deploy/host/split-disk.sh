#!/usr/bin/env bash
# Sépare l'espace de Japora de celui du système, sans toucher aux partitions.
#
# Un fichier de taille fixe (/srv/japora-data.img), formaté en ext4 et monté sur
# /srv/japora-data, reçoit tout ce qui grossit : les données de Docker (images,
# base PostgreSQL, photos, supervision) et les sauvegardes. S'il se remplit, seul
# Japora s'arrête : le système (SSH, journaux, mises à jour) garde son espace.
#
# Usage (une seule fois, avant le premier « deploy/mvp.sh up ») :
#   sudo deploy/host/split-disk.sh 13G
# Relancer le script ne refait rien de ce qui est déjà en place.
# Agrandir plus tard (Japora arrêté) : voir deploy/README.md, « Espace disque ».
set -euo pipefail

SIZE="${1:-}"
IMG=/srv/japora-data.img
MNT=/srv/japora-data
SYSTEM_RESERVE_GB=5          # espace minimum laissé au système
APP_DIR="${JAPORA_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
BACKUPS="$APP_DIR/backups"

die() { echo "ARRET : $*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "lancez ce script avec sudo."
command -v docker >/dev/null || die "Docker n'est pas installé."

# 1. Le disque dans un fichier ---------------------------------------------------
if mountpoint -q "$MNT"; then
  echo "1. $MNT est déjà monté : rien à créer."
else
  [ -n "$SIZE" ] || die "indiquez la taille, par exemple : sudo $0 13G"
  [[ "$SIZE" =~ ^[0-9]+G$ ]] || die "taille invalide « $SIZE » (exemple : 13G)."
  [ ! -e "$IMG" ] || die "$IMG existe déjà mais n'est pas monté : vérifiez avant de continuer."
  # Docker ne doit encore rien contenir : ce script ne déplace pas de données.
  if [ -n "$(docker ps -aq)" ] || [ -n "$(docker images -q)" ] || [ -n "$(docker volume ls -q)" ]; then
    die "Docker contient déjà des conteneurs, images ou volumes. Ce script est prévu pour une VM neuve."
  fi
  want_gb="${SIZE%G}"
  free_gb=$(( $(df --output=avail -B1G / | tail -1) ))
  (( free_gb - want_gb >= SYSTEM_RESERVE_GB )) \
    || die "il reste ${free_gb} Go libres sur / : ${SIZE} laisserait moins de ${SYSTEM_RESERVE_GB} Go au système."

  echo "1. Création de $IMG (${SIZE}) et montage sur $MNT"
  mkdir -p "$(dirname "$IMG")" "$MNT"
  fallocate -l "$SIZE" "$IMG"
  chmod 600 "$IMG"
  mkfs.ext4 -q -m 1 -L japora-data "$IMG"
  # nofail : si le montage échoue, la VM démarre quand même (seul Docker attend).
  grep -qF "$IMG $MNT " /etc/fstab \
    || echo "$IMG $MNT ext4 loop,nofail,x-systemd.device-timeout=30s 0 2" >> /etc/fstab
  systemctl daemon-reload
  mount "$MNT"
fi

# 2. Les sauvegardes sur le disque de Japora ------------------------------------
echo "2. Sauvegardes : $BACKUPS -> $MNT/backups"
mkdir -p "$MNT/backups" "$BACKUPS"
chown "$(stat -c %u:%g "$APP_DIR")" "$MNT/backups" "$BACKUPS"
if ! mountpoint -q "$BACKUPS"; then
  [ -z "$(ls -A "$BACKUPS")" ] || die "$BACKUPS n'est pas vide : déplacez son contenu dans $MNT/backups d'abord."
  grep -qF "$MNT/backups $BACKUPS " /etc/fstab \
    || echo "$MNT/backups $BACKUPS none bind,nofail,x-systemd.requires-mounts-for=$MNT 0 0" >> /etc/fstab
  systemctl daemon-reload
  mount "$BACKUPS"
fi

# 3. Docker sur le disque de Japora ---------------------------------------------
echo "3. Docker : données dans $MNT/docker"
mkdir -p "$MNT/docker" /etc/docker /etc/systemd/system/docker.service.d
# Docker ne démarre qu'une fois le disque de Japora monté : jamais sur le disque système.
cat > /etc/systemd/system/docker.service.d/japora-data.conf <<UNIT
[Unit]
RequiresMountsFor=$MNT
UNIT
python3 - "$MNT/docker" <<'PY'
import json, os, sys
path = "/etc/docker/daemon.json"
cfg = {}
if os.path.exists(path):
    with open(path) as f:
        cfg = json.load(f)
cfg["data-root"] = sys.argv[1]
# Journaux des conteneurs limités (en plus des limites posées dans docker-compose).
cfg.setdefault("log-driver", "json-file")
cfg.setdefault("log-opts", {"max-size": "10m", "max-file": "3"})
with open(path, "w") as f:
    json.dump(cfg, f, indent=2)
    f.write("\n")
PY
systemctl daemon-reload
systemctl restart docker
root_dir="$(docker info -f '{{.DockerRootDir}}')"
[ "$root_dir" = "$MNT/docker" ] || die "Docker utilise encore $root_dir."

echo
df -h / "$MNT" | sed 's/^/   /'
echo "Terminé. Docker et les sauvegardes utilisent $MNT ; le système garde le reste de /."
echo "Installez ensuite l'alerte : sudo deploy/host/install-disk-alert.sh"
