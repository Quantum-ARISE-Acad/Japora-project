# Vérifications automatiques de Japora

Le workflow `.github/workflows/ci.yml` s'exécute à chaque push de branche, sur les
pull requests vers `develop`, `staging` et `main`, sur les groupes de fusion et
manuellement depuis GitHub Actions lorsque le workflow est disponible sur la
branche par défaut. Il ne déploie rien et n'utilise aucun secret de production.

## Contrôles

| Job | Vérifications |
|---|---|
| Secrets & Workflow Validation | Historique Git avec Gitleaks (valeurs masquées), syntaxe GitHub Actions avec actionlint, scripts avec ShellCheck au niveau warning/error |
| Typecheck, Tests & Build | Fichiers sensibles suivis par Git, `npm ci`, validation Prisma, TypeScript, suites SQLite isolées, compilation Next.js |
| Docker, PostgreSQL, HTTPS & Backups | Validation du Compose MVP, construction des images réelles, 16 migrations PostgreSQL et absence de dérive, relations/JSON, accès HTTPS local via Caddy, catalogue et refus des accès non authentifiés, photos, sauvegardes planifiées et manuelles, restauration dans une autre base, persistance après recréation, scraping Prometheus et provisioning Grafana |
| CI result | Échoue si l'un des trois jobs échoue, est annulé ou ignoré |

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

## Ce qui reste à valider avant l'ouverture publique

Cette CI ne remplace pas une recette sur le serveur. Elle ne valide pas les
certificats publics et les DNS, les vrais comptes Clerk, les échanges Meta/Gemini,
les emails ni les paiements réels. Elle utilise le certificat local de Caddy et
des données fictives, sans clés externes. Les tests d'infrastructure ne remplacent
pas les parcours complets acheteur/vendeur dans un navigateur. Les collecteurs
de métriques hôte (node-exporter/cAdvisor) restent à valider sur le serveur cible.
La détection de secrets n'est pas un audit complet des dépendances ou de sécurité.

Dans les règles de protection GitHub, rendre **CI result** obligatoire avant
fusion. Un workflow seul ne bloque pas la fusion sans cette règle. Ce paramètre
est à configurer par un administrateur du dépôt.
