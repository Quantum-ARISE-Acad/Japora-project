/** Run the demo seed with the same .env loading and database path as the app. */
import { spawnSync } from "node:child_process";
import { loadDotEnv, resolveDatabaseUrl } from "../src/lib/db-url";

loadDotEnv();
const databaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL);
const result = spawnSync("tsx", ["prisma/seed.ts"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DATABASE_URL: databaseUrl },
});
process.exit(result.status ?? 1);
