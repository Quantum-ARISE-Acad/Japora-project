/**
 * Runs the Prisma CLI with DATABASE_URL resolved against the project folder,
 * so `db:push`, `db:migrate`... create/update the same SQLite file the site
 * opens (Prisma alone would resolve a relative path from the prisma/ folder).
 *
 * Usage: tsx scripts/prisma-cli.ts db push
 */
import { spawnSync } from "node:child_process";
import { loadDotEnv, resolveDatabaseUrl } from "../src/lib/db-url";

loadDotEnv();
const databaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL);
const result = spawnSync("npx", ["prisma", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DATABASE_URL: databaseUrl },
});
process.exit(result.status ?? 1);
