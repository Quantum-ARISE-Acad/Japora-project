# syntax=docker/dockerfile:1
# Japora (WCatalog) — Next.js + Prisma. Build de production reproductible.
FROM node:25-bookworm-slim
WORKDIR /app
# Correctifs de sécurité Debian, puis npm récent : celui livré avec l'image Node
# contient des failles connues (tar, pacote, sigstore…) signalées par Trivy en CI.
RUN apt-get update && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends openssl ca-certificates wget \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g npm@11.21.2 --no-audit --no-fund \
    && npm cache clean --force

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY . .
# Variables nécessaires AU BUILD seulement (les secrets runtime arrivent par docker compose).
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
ARG NEXT_PUBLIC_APP_URL="http://localhost:5174"
# Numéro du bot WhatsApp Japora ouvert par les QR des boutiques (vide = numéro du vendeur).
ARG NEXT_PUBLIC_WHATSAPP_BOT_NUMBER=""
# sqlite (développement, docker-compose.yml) ou postgresql (docker-compose.mvp.yml).
# Le dépôt reste en SQLite pour que le développement local ne change pas.
ARG PRISMA_PROVIDER="sqlite"
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_WHATSAPP_BOT_NUMBER=$NEXT_PUBLIC_WHATSAPP_BOT_NUMBER \
    UPLOADS_DIR="/app/public/uploads" \
    NEXT_TELEMETRY_DISABLED=1
RUN sed -i "s/provider = \"sqlite\"/provider = \"$PRISMA_PROVIDER\"/" prisma/schema.prisma \
    && case "$PRISMA_PROVIDER" in \
         postgresql) export DATABASE_URL="postgresql://build:build@127.0.0.1:1/build" ;; \
         *) export DATABASE_URL="file:/data/dev.db" ;; \
       esac \
    && npx prisma generate && npm run build \
    && mkdir -p public/uploads && chown -R node:node public/uploads .next

ENV NODE_ENV=production PORT=5174
VOLUME /data
EXPOSE 5174
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=8 CMD wget -qO- http://127.0.0.1:5174/ >/dev/null || exit 1
# PostgreSQL : migrations versionnées, sans risque pour les données. SQLite : schéma appliqué directement.
CMD ["sh", "-c", "case \"$DATABASE_URL\" in postgres*) npx prisma migrate deploy ;; *) npx prisma db push --skip-generate ;; esac && exec npx next start -H 0.0.0.0 -p 5174"]
