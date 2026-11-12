# Vérifications automatiques de Japora

Le workflow `.github/workflows/ci.yml` s'exécute à chaque push de branche, sur les
pull requests vers `develop`, `staging` et `main`, sur les groupes de fusion et
manuellement depuis GitHub Actions lorsque le workflow est disponible sur la
branche par défaut. Il ne déploie rien et n'utilise aucun secret de production.
Le déploiement est fait par un second workflow, `.github/workflows/cd.yml`, qui ne
démarre qu'après une CI verte (voir `deploy/README.md`, partie « Déploiement automatique »).

## Contrôles

| Job | Vérifications |
|---|---|
| Security — secrets, dependencies, code & workflows | Historique Git avec Gitleaks (valeurs masquées) ; syntaxe des workflows CI et CD avec actionlint ; scripts avec ShellCheck ; failles des dépendances de production avec `npm audit` (bloque élevé/critique, sauf exception datée dans `.github/ci/audit-allowlist.json`) ; analyse statique du code avec Semgrep (règles JavaScript, TypeScript, React, Next.js et secrets) |
| Typecheck, Tests & Build | Fichiers sensibles suivis par Git, `npm ci`, validation Prisma, TypeScript, suites SQLite isolées, compilation Next.js |
| Docker, PostgreSQL, HTTPS & Backups | Validation du Compose MVP et des configurations Caddy, Prometheus et Grafana, construction des images réelles, scan de l'image avec Trivy (bloque les failles critiques déjà corrigées en amont ; rapport élevé/critique en artefact), compteurs `/api/metrics` cachés du public et lus par Prometheus, 16 migrations PostgreSQL et absence de dérive, relations/JSON, accès HTTPS local via Caddy, catalogue et refus des accès non authentifiés, photos, sauvegardes planifiées et manuelles, restauration dans une autre base, persistance après recréation, scraping Prometheus et provisioning Grafana |
| CI result | Échoue si l'un des trois jobs échoue, est annulé ou ignoré. Le CD exige ce résultat vert pour le commit exact à déployer |

La CI et le Dockerfile utilisent **npm et `package-lock.json`**. Le fichier
`pnpm-lock.yaml` existant reste disponible pour les développeurs, mais une mise à
jour destinée au déploiement doit mettre à jour `package-lock.json`.

Les trois exceptions Gitleaks sont limitées aux empreintes exactes de faux
positifs vérifiés dans le commit initial : mot de passe public de démonstration
synthétique et variables M-Pesa vides. Aucun fichier entier n'est exclu.

## Exécuter les tests d'infrastructure sur son ordinateur

Prérequis : Docker avec Compose v2, Node.js 20, Bash, curl et accès Internet pour
les images et les polices utilisées au build. Depuis la racine du dépôt :

```bash
docker build --build-arg PRISMA_PROVIDER=postgresql --build-arg NEXT_PUBLIC_APP_URL=https://localhost -t japora-ci-app:local .
docker build -t japora-ci-backup:local deploy/backup
bash scripts/ci/infrastructure.sh
```

Les tests créent un projet `japora-ci-<date>-<pid>`, des volumes dédiés et un port
HTTPS aléatoire lié uniquement à `127.0.0.1`. Ils n'utilisent pas vos `.env`,
`.env.mvp`, `.env.keys`, votre dossier `backups/` ni les volumes `wataru-mvp`.
À la fin, même en cas d'échec, les ressources de ce projet de test sont supprimées.
Les journaux restent dans `ci-results/` (ignoré par Git et Docker). Le test
accélère l'intervalle de sauvegarde à cinq secondes, sans modifier le réglage de
production de six heures. La restauration ne remplace jamais la base source.

Sur GitHub, les résultats des tests et les journaux d'infrastructure sont conservés
comme artefacts pendant sept jours. Le workflow ne publie pas d'image Docker.

## Mises à jour automatiques

`.github/dependabot.yml` propose chaque lundi, en pull request vers `develop`, les
mises à jour npm, GitHub Actions et images Docker (les correctifs de sécurité
arrivent dès qu'ils sont connus). Les changements majeurs de Next.js et Prisma sont
exclus jusqu'après la foire.

## Image Docker

Le Dockerfile applique les correctifs de sécurité Debian (`apt-get upgrade`) et
remplace le `npm` livré avec l'image Node (failles connues dans `tar`, `pacote`,
`sigstore`) par une version récente fixée. Si Trivy bloque, reconstruire l'image
suffit souvent : les correctifs Debian arrivent sans changer le code.

## Exceptions de sécurité des dépendances

Une exception dans `.github/ci/audit-allowlist.json` doit avoir une raison et une
date limite. Après cette date, la CI échoue de nouveau. Vérifier à la main :

```bash
node scripts/ci/audit.cjs
```

## Ce qui reste à valider avant l'ouverture publique

Cette CI ne remplace pas une recette sur le serveur. Elle ne valide pas les
certificats publics et les DNS, les vrais comptes Clerk, les échanges Meta/Gemini,
les emails ni les paiements réels. Elle utilise le certificat local de Caddy et
des données fictives, sans clés externes. Les tests d'infrastructure ne remplacent
pas les parcours complets acheteur/vendeur dans un navigateur. Les collecteurs
de métriques hôte (node-exporter/cAdvisor) restent à valider sur le serveur cible.
Il n'y a pas encore de tests navigateur de bout en bout (Playwright) ni de seuil de
couverture de code : ce sont les deux prochains ajouts utiles.

Dans les règles de protection GitHub, rendre **CI result** obligatoire avant
fusion. Un workflow seul ne bloque pas la fusion sans cette règle. Ce paramètre
est à configurer par un administrateur du dépôt.
