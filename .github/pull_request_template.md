## Description des changements
<!-- Décrivez brièvement ce que fait cette Pull Request -->

## Type de changement
- [ ] `feat` : Nouvelle fonctionnalité
- [ ] `fix` : Correction de bug
- [ ] `hotfix` : Correctif urgent en production
- [ ] `chore` / `refactor` : Maintenance, refactoring ou configuration

## Branche cible
- [ ] `develop` (Intégration développement)
- [ ] `staging` (Pré-production / QA)
- [ ] `main` (Production)

## Checklist avant fusion
- [ ] Mon code compile sans erreur (`pnpm build` ou `npm run build`)
- [ ] Aucun fichier sensible (`.env`, clés API, `*.db`) n'est inclus
- [ ] Si de nouvelles variables d'environnement ont été ajoutées, `.env.example` a été mis à jour
- [ ] Si le schéma Prisma a changé, les migrations sont propres et testées
