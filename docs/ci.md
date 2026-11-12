# CI/CD de Japora

| Stage | Job | Ce qu'il contrôle |
|---|---|---|
| Stage 1 | Secret Scan (Gitleaks) | Aucun mot de passe ni clé secrète dans tout l'historique Git, et aucun fichier `.env` ou base de données envoyé sur GitHub. |
| Stage 1 | Dependency Audit (npm audit) | Les bibliothèques utilisées n'ont pas de faille grave connue (sauf exception écrite, avec une raison et une date limite). |
| Stage 1 | Code Security Analysis (Semgrep) | Le code ne contient pas d'erreur de sécurité classique : injection, faille XSS, secret écrit dans le code. |
| Stage 1 | Workflows & Shell Scripts | Les fichiers de la CI et du CD sont bien écrits, et les scripts de déploiement n'ont pas d'erreur. |
| Stage 1 | Lint (ESLint, no warnings) | Le code respecte les règles de l'équipe, sans aucun avertissement. |
| Stage 1 | Typecheck & Prisma Schema | Le code TypeScript n'a pas d'erreur de type, et le schéma de la base de données est valide. |
| Stage 2 | Tests (unit) | Les tests qui n'ont pas besoin de base de données passent (calculs, prix, livraison, messages…). |
| Stage 2 | Tests (database) | Les tests avec une vraie base de données passent (commandes, paiements, boutiques séparées…). |
| Stage 2 | Build Next.js | Le site se construit complètement, sans erreur. |
| Stage 3 | Deployment Configuration | Les fichiers du serveur sont valides : Docker Compose, Caddy (HTTPS), Prometheus et Grafana. |
| Stage 3 | Docker Image (app) & Trivy | L'image du site se construit, et elle ne contient pas de faille critique qui a déjà un correctif. |
| Stage 3 | Docker Image (backup) & Trivy | L'image des sauvegardes se construit, avec un rapport de ses failles connues. |
| Stage 3 | Infrastructure | Tout le serveur fonctionne pour de vrai : base PostgreSQL et migrations, HTTPS, photos, sauvegarde et restauration, compteurs et tableau Grafana. |
| Stage 4 | CI result | Tous les jobs précédents sont verts. C'est ce résultat que le CD exige avant de déployer. |
| Stage 5 | Choose version and environment | La version à déployer a une CI verte, et choisit où l'envoyer : `develop` vers staging, `main` vers production. |
| Stage 5 | Deploy | Déploie sur le serveur avec sauvegarde avant, revient seul à l'ancienne version en cas d'erreur, puis vérifie le site depuis Internet. |
