# syntax=docker/dockerfile:1
# Japora (WCatalog) — Next.js + Prisma. Build de production reproductible.
FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates wget \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY . .
# Variables nécessaires AU BUILD seulement (les secrets runtime arrivent par docker compose).
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
ARG NEXT_PUBLIC_APP_URL="http://localhost:5174"
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    DATABASE_URL="file:/data/dev.db" \
    UPLOADS_DIR="/data/uploads" \
    NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

ENV NODE_ENV=production PORT=5174
VOLUME /data
EXPOSE 5174
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=8 CMD wget -qO- http://127.0.0.1:5174/ >/dev/null || exit 1
# Le schéma est appliqué à chaque démarrage : une nouvelle version avec de nouvelles tables se met à jour seule.
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx next start -H 0.0.0.0 -p 5174"]
