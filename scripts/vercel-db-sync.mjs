/**
 * Pre-build database schema sync for Vercel / Production deployments.
 *
 * When a fresh cloud MySQL database is connected on Vercel (TiDB, PlanetScale,
 * Aiven, Railway, etc.), the tables (`Vendor`, `Product`, `Order`, ...) do not
 * exist yet until `prisma db push` is executed. Running it automatically during
 * the build guarantees the production database always has the latest schema.
 *
 * If DATABASE_URL is missing or points to an unreachable localhost during a CI
 * check, we log a warning and let `next build` continue without failing.
 */
import { execSync } from "node:child_process";

const dbUrl = (process.env.DATABASE_URL || "").trim();

const isRemoteMysql =
  (dbUrl.startsWith("mysql://") || dbUrl.startsWith("mysqls://")) &&
  !dbUrl.includes("localhost") &&
  !dbUrl.includes("127.0.0.1");

const shouldPush = Boolean(process.env.VERCEL) || isRemoteMysql;

if (shouldPush && dbUrl) {
  console.log("[db-sync] Synchronizing Prisma schema with remote MySQL database...");
  try {
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      stdio: "inherit",
    });
    console.log("[db-sync] Remote MySQL schema is up to date.");
  } catch (err) {
    console.warn(
      "[db-sync] Warning: could not run `prisma db push` during build:",
      err?.message || err,
    );
  }
} else {
  console.log("[db-sync] Skipping remote `prisma db push` (local environment).");
}

