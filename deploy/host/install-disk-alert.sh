#!/usr/bin/env bash
# Installe l'alerte e-mail « disque presque plein » sur la VM (minuteur systemd, toutes les 5 minutes).
# Usage : sudo deploy/host/install-disk-alert.sh
# Puis remplissez /etc/japora/alerts.env et testez : sudo /usr/local/sbin/japora-disk-alert --test
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Lancez ce script avec sudo." >&2; exit 1; }
HERE="$(cd "$(dirname "$0")" && pwd)"

install -m 755 "$HERE/disk-alert.sh" /usr/local/sbin/japora-disk-alert
install -d -m 700 /etc/japora
if [ ! -e /etc/japora/alerts.env ]; then
  install -m 600 "$HERE/alerts.env.example" /etc/japora/alerts.env
  echo "Modèle créé : /etc/japora/alerts.env (à remplir avec les identifiants SMTP)."
else
  echo "/etc/japora/alerts.env existe déjà : conservé."
fi

cat > /etc/systemd/system/japora-disk-alert.service <<'UNIT'
[Unit]
Description=Japora : alerte e-mail si un disque se remplit
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/japora-disk-alert
UNIT

cat > /etc/systemd/system/japora-disk-alert.timer <<'UNIT'
[Unit]
Description=Japora : vérifie l'espace disque toutes les 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now japora-disk-alert.timer
echo "Alerte disque installée. Prochaine vérification :"
systemctl list-timers japora-disk-alert.timer --no-pager | sed -n 2p
