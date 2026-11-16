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
deploy/mvp.sh init japora.mondomaine.com info@quantum-arise.com
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
| Déployer le nouveau code | automatique (CD, voir plus bas) ou `deploy/mvp.sh update` |
| Sauvegarder maintenant | `deploy/mvp.sh backup` |
| Restaurer | `deploy/mvp.sh restore backups/japora-AAAAMMJJ-HHMMSS` |
| Tout arrêter, sans effacer les données | `deploy/mvp.sh down` |

Ne lancez jamais `docker compose down -v` : le `-v` efface la base et les photos.

`update` s'arrête sans rien remplacer si `schema.prisma` a changé sans migration.

## Déploiement automatique (CD)

Le workflow `.github/workflows/cd.yml` déploie tout seul quand la CI est verte :

| Branche | Environnement GitHub | Quand |
|---|---|---|
| `develop` | `staging` | à chaque push dont la CI est verte |
| `main` | `production` | à chaque push dont la CI est verte, après approbation |

Il se connecte au serveur en SSH et lance `deploy/mvp.sh deploy <commit>`, qui :
construit la nouvelle version, vérifie que le schéma a ses migrations, fait une
sauvegarde, remplace les conteneurs, puis attend que `/api/health` réponde.
**Si une étape échoue, il revient seul à la version précédente.** Ensuite GitHub
vérifie le site depuis Internet (`/api/health` répond, `/api/metrics` reste caché).
On peut aussi déployer à la main : onglet *Actions* → *CD — Deploy* → *Run workflow*.

Tant que le serveur n'est pas configuré, le CD s'arrête avec le message
« Déploiement ignoré » : il ne casse rien.

### Mise en place (une seule fois, par un administrateur du dépôt)

1. Sur le serveur, faire le premier déploiement à la main (parties ci-dessus), avec
   le dépôt cloné dans un dossier, par exemple `/opt/japora`.
2. Créer une clé SSH réservée au déploiement : `ssh-keygen -t ed25519 -f japora-deploy -N ""`.
   Ajouter `japora-deploy.pub` dans `~/.ssh/authorized_keys` de l'utilisateur du serveur
   (membre du groupe `docker`).
3. Pour que le serveur puisse lire le dépôt privé : *Settings → Deploy keys* (lecture seule).
4. Dans GitHub : *Settings → Environments* → créer `staging` et `production`.
   Pour `production`, cocher **Required reviewers** (personne n'envoie en production sans accord).
5. Dans chaque environnement, ajouter :

| Nom | Type | Valeur |
|---|---|---|
| `DEPLOY_HOST` | secret | adresse IP ou nom du serveur |
| `DEPLOY_USER` | secret | utilisateur SSH |
| `DEPLOY_PORT` | secret (facultatif) | port SSH, 22 par défaut |
| `DEPLOY_PATH` | secret | dossier du dépôt sur le serveur, ex. `/opt/japora` |
| `DEPLOY_SSH_KEY` | secret | contenu de la clé privée `japora-deploy` |
| `DEPLOY_KNOWN_HOSTS` | secret | résultat de `ssh-keyscan -t ed25519 <serveur>` (vérifié à la main) |
| `DEPLOY_URL` | variable | adresse publique, ex. `https://japora.market` |

Règle importante : une migration doit rester compatible avec la version précédente
du code (ajouter une colonne, pas en supprimer). Sinon le retour arrière automatique
ne pourrait pas fonctionner. Le journal des versions déployées est dans `deploy/.deployed`.

## Si vous changez le schéma de la base

Le dépôt reste en SQLite pour le développement, et le serveur utilise PostgreSQL.
Chaque changement de `schema.prisma` doit donc être accompagné d'une migration
PostgreSQL dans `prisma/migrations/`.

## Photos dans Cloudflare R2 (stockage externe)

Par défaut, les photos des produits sont enregistrées sur le serveur. Pour libérer
son disque et faire survivre les photos à une panne du serveur, placez-les dans
Cloudflare R2. Jusqu'à 10 Go, R2 est gratuit et ne facture pas les téléchargements.

1. Dans Cloudflare, ouvrez **R2**, puis créez un bucket, par exemple `japora-photos`.
2. Dans les réglages du bucket, activez l'accès public : l'adresse `r2.dev` ou,
   mieux, un sous-domaine à vous, comme `photos.votre-domaine`.
3. Dans **R2 > Manage API tokens**, créez une clé avec le droit
   « Object Read & Write » limitée à ce bucket. Notez l'Access Key ID et le Secret.
4. Ajoutez dans `.env.keys`, sur le serveur :

   ```bash
   STORAGE_S3_BUCKET=japora-photos
   STORAGE_S3_REGION=auto
   STORAGE_S3_ENDPOINT=https://<ID_DU_COMPTE>.r2.cloudflarestorage.com
   STORAGE_S3_ACCESS_KEY_ID=...
   STORAGE_S3_SECRET_ACCESS_KEY=...
   STORAGE_S3_PUBLIC_URL=https://photos.votre-domaine
   ```

5. Pour appliquer les réglages, lancez `deploy/mvp.sh up`. Dans Japora, **Réglages >
   Stockage des photos** doit alors afficher « Stockage externe (S3 / R2) ». S'il
   affiche « Configuration incomplète », la page liste les réglages manquants.
6. Transférez les photos déjà présentes sur le serveur :

   ```bash
   deploy/mvp.sh photos-s3           # essai : affiche ce qui sera copié
   deploy/mvp.sh photos-s3 --apply   # copie les photos et met à jour les liens
   ```

   Vous pouvez relancer la commande sans risque. Les fichiers restent sur le serveur
   et dans ses sauvegardes jusqu'à ce que vous les effaciez vous-même.

Les sauvegardes toutes les 6 heures ne copient pas les photos rangées dans R2.
Cloudflare les conserve en plusieurs exemplaires. Pour garder une copie
supplémentaire, activez une règle de réplication sur le bucket.

## Sauvegardes

Toutes les 6 heures, un dossier `backups/japora-<date>` reçoit la base et les photos.
Les dossiers de plus de 30 jours sont supprimés (réglable avec BACKUP_KEEP_DAYS).

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
