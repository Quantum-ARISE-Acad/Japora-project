import path from "node:path";
import os from "node:os";
import { PrismaClient } from "@prisma/client";

// Single definition shared with the Prisma CLI wrapper and the seed script, so the
// site, `db:push` and `db:seed` always open the very same SQLite file.
import { DEFAULT_DATABASE_URL, resolveDatabaseUrl } from "./db-url";
export { resolveDatabaseUrl };

void DEFAULT_DATABASE_URL;
const resolvedDatabaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL);

export function assertIsolatedTestDatabase(databaseUrl: string): void {
  if (process.env.NODE_ENV !== "test" && process.env.WATURU_TEST_MODE !== "1") return;

  const testRoot = process.env.WATURU_TEST_DB_ROOT;
  const rawDbPath = databaseUrl.startsWith("file:") ? databaseUrl.slice("file:".length) : "";
  if (
    !testRoot ||
    !rawDbPath ||
    rawDbPath.startsWith("//") ||
    !path.isAbsolute(rawDbPath) ||
    databaseUrl.includes("?")
  ) {
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
