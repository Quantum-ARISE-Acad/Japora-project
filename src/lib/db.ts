import path from "node:path";
import os from "node:os";
import { PrismaClient } from "@prisma/client";

const DEFAULT_DATABASE_URL = "file:./prisma/dev.db";

export function resolveDatabaseUrl(
  rawUrl: string | undefined = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  workingDirectory = process.cwd(),
): string {
  const configuredUrl = rawUrl?.trim() || DEFAULT_DATABASE_URL;
  if (!configuredUrl.startsWith("file:")) return configuredUrl;

  const relativePath = configuredUrl.slice("file:".length);
  if (!relativePath || relativePath.startsWith("//") || relativePath.startsWith("/")) {
    return configuredUrl;
  }

  const normalized = relativePath.replace(/^\.\/+/u, "");
  return `file:${path.resolve(workingDirectory, normalized)}`;
}

const resolvedDatabaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL);

export function assertIsolatedTestDatabase(databaseUrl: string): void {
  if (process.env.NODE_ENV !== "test" && process.env.WATURU_TEST_MODE !== "1") return;

  const testRoot = process.env.WATURU_TEST_DB_ROOT;
  if (!testRoot || !databaseUrl.startsWith("file:/") || databaseUrl.includes("?")) {
    throw new Error("WCatalog tests require an absolute SQLite database under WATURU_TEST_DB_ROOT.");
  }

  const databasePath = path.resolve(databaseUrl.slice("file:".length));
  const rootPath = path.resolve(testRoot);
  const relativePath = path.relative(rootPath, databasePath);
  const systemTmp = path.resolve(process.env.ORIGINAL_TMPDIR || "/tmp");
  const relativeToSysTmp = path.relative(systemTmp, rootPath);
  const relativeToTmp = path.relative(path.resolve(os.tmpdir()), rootPath);
  const isUnderTmp =
    (!relativeToSysTmp.startsWith("..") && !path.isAbsolute(relativeToSysTmp)) ||
    (!relativeToTmp.startsWith("..") && !path.isAbsolute(relativeToTmp)) ||
    path.resolve(os.tmpdir()).startsWith(rootPath);
  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath) ||
    !isUnderTmp
  ) {
    throw new Error("WCatalog test database is outside its disposable temporary root.");
  }
}

assertIsolatedTestDatabase(resolvedDatabaseUrl);
if (process.env.DATABASE_URL !== resolvedDatabaseUrl) {
  process.env.DATABASE_URL = resolvedDatabaseUrl;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolvedDatabaseUrl,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
