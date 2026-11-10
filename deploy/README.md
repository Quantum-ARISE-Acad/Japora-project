# Déploiement MVP de Japora (Foire de Lomé)

Ce dossier déploie sur le serveur Quantum Arise : Japora, PostgreSQL, le HTTPS avec
Caddy, les sauvegardes et la supervision.

## Ce qui tourne

| Module | Fichier | Services |
|---|---|---|
| Proxy | `compose/proxy.yml` | Caddy : seul service ouvert sur Internet (80 et 443) |
| Données | `compose/data.yml` | PostgreSQL, sauvegarde toutes les 6 heures |
| Application | `compose/app.yml` | Japora, planificateur des tâches |
| Supervision | `compose/observability.yml` | Prometheus, Grafana, collecteurs de mesures |

## Premier déploiement

Il faut un serveur Linux avec Docker et un domaine.

### 1. Le DNS sur Cloudflare

Créez deux enregistrements `A` vers l'adresse IP du serveur :

| Nom | Contenu | Proxy |
|---|---|---|
| `japora` (ou votre sous-domaine) | IP du serveur | **DNS only** (nuage gris) |
| `grafana.japora` | IP du serveur | **DNS only** (nuage gris) |

Gardez « DNS only » pour le premier déploiement. Si vous activez ensuite le nuage
orange, réglez SSL/TLS sur **Full (strict)**.

### 2. Le pare-feu du serveur

Autorisez SSH en premier, sinon vous perdez l'accès au serveur :

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443
sudo ufw enable
```

### 3. Installer Docker et récupérer le code

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # puis déconnectez-vous et reconnectez-vous
git clone https://github.com/Quantum-ARISE-Acad/Japora-project.git
cd Japora-project
git switch main
```

### 4. Configurer et lancer

```bash
deploy/mvp.sh init japora.mondomaine.com wataru.japora@gmail.com
```

Cette commande crée `.env.mvp` avec des secrets générés. Rangez-en une copie dans
le coffre-fort de l'équipe : sans elle, une restauration sur un autre serveur échoue.

Mettez les clés des services (Clerk, Meta, Gemini, paiements) dans `.env.keys`, sur
le modèle de `.env.example`. Inutile d'y mettre `DATABASE_URL`, `SESSION_SECRET` ou
`NEXT_PUBLIC_APP_URL` : le déploiement les fixe lui-même. Puis :

```bash
deploy/mvp.sh up
deploy/mvp.sh ps    # tout doit finir en "healthy" ou "running"
```

Le premier lancement prend plusieurs minutes.

### 5. Vérifier

- `https://japora.mondomaine.com` s'ouvre sur un téléphone en 4G, avec le cadenas.
- `https://japora.mondomaine.com/api/health` indique `"status":"ok"`.
- `https://grafana.japora.mondomaine.com` demande une connexion : utilisateur
  `admin`, mot de passe `GRAFANA_ADMIN_PASSWORD` de `.env.mvp`.

## Au quotidien

| Besoin | Commande |
|---|---|
| Voir l'état | `deploy/mvp.sh ps` |
| Lire les journaux | `deploy/mvp.sh logs wcatalog` |
| Déployer le nouveau code | `deploy/mvp.sh update` |
| Sauvegarder maintenant | `deploy/mvp.sh backup` |
| Restaurer | `deploy/mvp.sh restore backups/japora-AAAAMMJJ-HHMMSS` |
| Tout arrêter, sans effacer les données | `deploy/mvp.sh down` |

Ne lancez jamais `docker compose down -v` : le `-v` efface la base et les photos.

`update` s'arrête sans rien remplacer si `schema.prisma` a changé sans migration.

## Si vous changez le schéma de la base

Le dépôt reste en SQLite pour le développement, et le serveur utilise PostgreSQL.
Chaque changement de `schema.prisma` doit donc être accompagné d'une migration
PostgreSQL dans `prisma/migrations/`.

## Sauvegardes

Toutes les 6 heures, un dossier `backups/japora-<date>` reçoit la base et les photos.
Les dossiers de plus de 7 jours sont supprimés.

**Elles restent sur le serveur : si son disque est perdu, elles le sont aussi.**
Copiez-les régulièrement ailleurs, depuis votre ordinateur :

```bash
rsync -av utilisateur@IP_DU_SERVEUR:Japora-project/backups/ ./sauvegardes-japora/
```

Ces fichiers contiennent des données de clients : gardez-les dans un endroit protégé.

## Écran du stand

Connectez-vous à Grafana sur le navigateur de l'écran, puis ajoutez `?kiosk` à
l'adresse du tableau de bord « Japora — Foire de Lomé ». Il se met à jour toutes les
10 secondes.

## Variables utiles

- `JAPORA_ENABLE_DEV_PAY_STUB` dans `.env.mvp` : `1` active le paiement simulé du
  stand. N'importe qui peut alors marquer une commande payée : ne l'activez jamais
  avec de vrais paiements.
- `CADDY_HTTP_PORT` et `CADDY_HTTPS_PORT` : uniquement pour tester sur une machine
  où les ports 80 et 443 sont pris.
- Changer le domaine impose un nouveau build (`deploy/mvp.sh up`), car l'adresse est
  inscrite dans le code au build.
