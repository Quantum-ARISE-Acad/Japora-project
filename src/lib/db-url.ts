import path from "node:path";

export const DEFAULT_DATABASE_URL = "file:./prisma/dev.db";

/**
 * Turns a relative SQLite URL into an absolute one, relative to the project
 * folder. Prisma's own CLI (and a bare `new PrismaClient()`) resolve relative
 * paths from the prisma/ folder instead, which produced two different files
 * (prisma/dev.db for the site, prisma/prisma/dev.db for db:push / db:seed).
 * Everything now goes through this function so there is only one file.
 */
export function resolveDatabaseUrl(
  rawUrl: string | undefined = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  workingDirectory = process.cwd(),
): string {
  const configuredUrl = rawUrl?.trim() || DEFAULT_DATABASE_URL;
  if (!configuredUrl.startsWith("file:")) return configuredUrl;

  const relativePath = configuredUrl.slice("file:".length);
  if (
    !relativePath ||
    relativePath.startsWith("//") ||
    relativePath.startsWith("/") ||
    path.isAbsolute(relativePath)
  ) {
    return configuredUrl;
  }

  const normalized = relativePath.replace(/^\.\/+/u, "");
  return `file:${path.resolve(workingDirectory, normalized)}`;
}

/** Loads .env into process.env (without overriding real variables) when DATABASE_URL is not set yet. */
export function loadDotEnv(): void {
  if (process.env.DATABASE_URL) return;
  try {
    process.loadEnvFile(path.resolve(process.cwd(), ".env"));
  } catch {
    // No .env file — the default URL applies.
  }
}
