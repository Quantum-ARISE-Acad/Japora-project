## Description

<!-- Décrivez brièvement les changements apportés par cette Pull Request -->

## Type de changement

- [ ] `feat` : Nouvelle fonctionnalité
- [ ] `fix` : Correction de bug
- [ ] `refactor` : Refactoring (ni fonctionnalité ni correction)
- [ ] `docs` : Documentation
- [ ] `chore` : Maintenance / CI / Dépendances

## Branche cible

- [ ] `develop` (Développement quotidien — par défaut pour toute feature/fix)
- [ ] `staging` (Pré-production / Recette QA)
- [ ] `main` (Production — uniquement depuis `staging` ou `hotfix/*`)

## Checklist avant merge

- [ ] Mon code compile sans erreur (`pnpm build` & `pnpm exec tsc --noEmit`)
- [ ] Les tests passent localement (`pnpm test`)
- [ ] Aucun fichier sensible (`.env`, clés API, `*.db`) n'est inclus dans ce commit
- [ ] Si de nouvelles variables d'environnement ont été ajoutées, elles sont documentées dans `.env.example`
- [ ] Si le schéma Prisma a changé, une migration propre a été générée dans `prisma/migrations`
