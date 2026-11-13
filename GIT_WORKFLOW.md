# Guide de Travail en Équipe & Stratégie de Branches (Git Flow) — Japora

Ce dépôt utilise un système de branches structuré pour séparer clairement le **développement en équipe**, la **pré-production (QA / test)** et la **production**.

---

## 1. Architecture des Branches Principales

```mermaid
gitGraph
   commit id: "Initial"
   branch develop
   checkout develop
   commit id: "Setup dev"
   branch feat/whatsapp-bot
   checkout feat/whatsapp-bot
   commit id: "Add bot handler"
   checkout develop
   merge feat/whatsapp-bot id: "PR -> develop"
   branch staging
   checkout staging
   merge develop id: "PR -> staging (QA)"
   checkout main
   merge staging id: "Release Prod" tag: "v1.0.0"
```

| Branche | Rôle | Environnement | Règle d'accès |
| :--- | :--- | :--- | :--- |
| **`main`** | Code stable en **Production** | Production (`japora.market`) | **Protégée** — Merge uniquement via Pull Request depuis `staging` ou `hotfix/*` |
| **`staging`** | **Pré-production / QA** (Tests d'intégration et validation client) | Staging / Preview | **Protégée** — Merge uniquement via Pull Request depuis `develop` |
| **`develop`** | **Développement d'équipe** (Branche centrale d'intégration) | Dev / Local | **Protégée** — Merge via Pull Request depuis les branches `feat/*`, `fix/*`, `chore/*` |

---

## 2. Branches de Travail (Équipe de Développement)

Aucun développeur ne travaille directement sur `main`, `staging` ou `develop`. Chaque tâche passe par une branche dédiée créée à partir de **`develop`** :

- **`feat/<nom-fonctionnalite>`** : Nouvelle fonctionnalité (ex. `feat/paiement-tmoney`, `feat/catalogue-vendeur`)
- **`fix/<nom-bug>`** : Correction de bug détecté en développement ou QA (ex. `fix/panier-calcul-total`)
- **`refactor/<nom-tache>`** : Amélioration interne du code sans changement fonctionnel
- **`chore/<nom-tache>`** : Maintenance, dépendances, configuration (ex. `chore/update-prisma`)
- **`hotfix/<nom-correctif>`** : Bug critique en **production uniquement** (créée depuis `main`, puis fusionnée dans `main` **et** `develop`)

---

## 3. Cycle de Vie d'une Fonctionnalité (Workflow Quotidien)

### Étape 1 — Récupérer la dernière version de `develop`
```bash
git checkout develop
git pull origin develop
```

### Étape 2 — Créer sa branche de travail
```bash
git checkout -b feat/ma-fonctionnalite
```

### Étape 3 — Développer et commiter régulièrement (Conventional Commits)
- `feat: ajout du webhook CinetPay`
- `fix: correction de la validation du numéro WhatsApp`
- `chore: mise à jour du schéma Prisma`

```bash
pnpm test
pnpm build
git add .
git commit -m "feat: description claire du changement"
git push -u origin feat/ma-fonctionnalite
```

### Étape 4 — Ouvrir une Pull Request (PR)
1. Sur GitHub, ouvrir une **Pull Request** de `feat/ma-fonctionnalite` vers **`develop`**.
2. Attendre que la CI GitHub Actions (**Typecheck, Tests & Build**) passe au vert.
3. Au moins **1 membre de l'équipe** relit le code (Code Review).
4. Une fois approuvée, fusionner (**Squash and Merge** recommandé) dans `develop`.

---

## 4. Processus de Déploiement (Staging -> Production)

1. **Mise en Pré-production (`staging`)** :
   - Ouvrir une PR de `develop` -> `staging`.
   - Tester les nouvelles fonctionnalités et migrations Prisma sur l'environnement de staging.
2. **Mise en Production (`main`)** :
   - Une fois `staging` validé par l'équipe QA, ouvrir une PR de `staging` -> `main`.
   - Après le merge sur `main`, tagger la version (ex. `git tag -a v1.1.0 -m "Release v1.1.0" && git push origin v1.1.0`).

---

## 5. Sécurité & Fichiers Sensibles (`.env`)

- **Récupération du fichier `.env` pour l'équipe** : Le fichier `.env` est partagé en privé pour les membres de l'équipe sur Google Drive :
  👉 **[Télécharger le `.env` sur Google Drive](https://drive.google.com/drive/folders/1XXs6psLdMgQMPkFWJYSFxkbAbfPUt4YR?usp=sharing)**
- **Ne jamais commiter** de fichiers `.env`, `.env.local`, `.env.production`, clés privées (`*.pem`, `*.key`), ni de bases SQLite locales (`*.db`).
- Si une nouvelle variable d'environnement est nécessaire, l'ajouter **sans valeur secrète** dans `.env.example`, mettre à jour le `.env` sur le Drive de l'équipe et prévenir l'équipe.
- La pipeline CI (`.github/workflows/ci.yml`) vérifie automatiquement à chaque push et Pull Request qu'aucun fichier `.env` ou `.db` n'est versionné.

---

## 6. Règles de Protection des Branches sur GitHub (Branch Protection)

Dans **Settings ➔ Branches** sur le dépôt GitHub `Quantum-ARISE-Acad/Japora-project`, activer une règle de protection pour **`main`**, **`staging`** et **`develop`** :
- [x] **Require a pull request before merging** (avec au moins 1 approbation pour `main` et `staging`)
- [x] **Require status checks to pass before merging** (cocher le job CI `Stage 4 · CI result`, qui regroupe les contrôles de code, sécurité et infrastructure ; voir `docs/ci.docx`)
- [x] **Block force pushes**
