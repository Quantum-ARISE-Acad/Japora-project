import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseTapSummary } from "./tap-summary";

const projectRoot = process.cwd();
const testsDir = path.join(projectRoot, "tests");
const tempRoot = mkdtempSync(path.join(os.tmpdir(), "wcatalog-test-run-"));

function cleanup() {
  if (existsSync(tempRoot)) rmSync(tempRoot, { recursive: true, force: true });
}

process.once("exit", cleanup);
process.once("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.once("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

const prismaCli = path.join(projectRoot, "node_modules", "prisma", "build", "index.js");
const databaseSuites = new Set([
  "bus.test.ts",
  "campaign-safety.test.ts",
  "flow.test.ts",
  "orders-delivery.test.ts",
  "stand-readiness.test.ts",
  "integration.test.ts",
  "telemetry.test.ts",
]);
const testFiles = readdirSync(testsDir).filter((name) => name.endsWith(".test.ts")).sort();

let passed = 0;
let failed = 0;
let skipped = 0;
let todo = 0;
let cancelled = 0;
let errored = 0;
let failedSuites = 0;

if (testFiles.length === 0) {
  console.error("No WCatalog test suites were discovered.");
  errored = 1;
  failedSuites = 1;
}

function isolatedEnv(suiteTemp: string, databaseUrl: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: suiteTemp,
    TMPDIR: suiteTemp,
    TEMP: suiteTemp,
    TMP: suiteTemp,
    CI: "1",
    NODE_ENV: "test",
    WATURU_TEST_MODE: "1",
    WATURU_TEST_DB_ROOT: tempRoot,
    DATABASE_URL: databaseUrl,
    SESSION_SECRET: "wataru-isolated-test-session-secret",
    NEXT_PUBLIC_APP_URL: "http://localhost:5174",
    RUST_LOG: "trace",
    PRISMA_HIDE_UPDATE_MESSAGE: "1",
  };
  if (process.platform === "win32") env.SystemRoot = process.env.SystemRoot;
  return env;
}

function run(command: string, args: string[], suiteTemp: string, databaseUrl: string) {
  return spawnSync(command, args, {
    cwd: projectRoot,
    env: isolatedEnv(suiteTemp, databaseUrl),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}

console.log(`Running ${testFiles.length} suites with isolated temporary SQLite databases.`);
console.log(`Disposable test root: ${tempRoot}`);

for (const file of testFiles) {
  const suiteTemp = mkdtempSync(path.join(tempRoot, `${file.replace(/[^a-zA-Z0-9-]/g, "-")}-`));
  const databaseUrl = `file:${path.join(suiteTemp, "test.db")}`;
  let suiteFailed = false;
  let suiteError = false;
  let suiteStats: ReturnType<typeof parseTapSummary> | undefined;

  if (databaseSuites.has(file)) {
    if (!existsSync(prismaCli)) {
      console.error(`${file}: Prisma CLI is missing at the expected local path.`);
      errored += 1;
      failedSuites += 1;
      suiteFailed = true;
      suiteError = true;
    } else {
      const setup = run(process.execPath, [prismaCli, "db", "push", "--schema", "prisma/schema.prisma", "--skip-generate"], suiteTemp, databaseUrl);
      if (setup.stdout) process.stdout.write(setup.stdout);
      if (setup.stderr) process.stderr.write(setup.stderr);
      if (setup.error || setup.status !== 0) {
        console.error(`${file}: disposable SQLite schema setup failed; suite was not executed.`);
        if (setup.error) console.error(setup.error.message);
        errored += 1;
        failedSuites += 1;
        suiteFailed = true;
        suiteError = true;
      }
    }
  }

  if (!suiteFailed) {
    const result = run(process.execPath, ["--import", "tsx", "--test", "--test-reporter=tap", path.join("tests", file)], suiteTemp, databaseUrl);
    const output = result.stdout ?? "";
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) console.error(`${file}: child process error: ${result.error.message}`);
    else if (result.status === null) console.error(`${file}: child process returned no exit status.`);

    try {
      const stats = parseTapSummary(output);
      suiteStats = stats;
      passed += stats.passed;
      failed += stats.failed;
      cancelled += stats.cancelled;
      skipped += stats.skipped;
      todo += stats.todo;
      if (result.error || result.status === null) {
        errored += 1;
        suiteError = true;
      }
      if (result.error || result.status !== 0 || stats.failed > 0 || stats.cancelled > 0) {
        failedSuites += 1;
        suiteFailed = true;
      }
    } catch (error) {
      errored += 1;
      failedSuites += 1;
      suiteFailed = true;
      suiteError = true;
      console.error(`${file}: invalid or incomplete TAP summary (status ${result.status ?? "unknown"}).`);
      console.error(error instanceof Error ? error.message : String(error));
    }
  }

  const suiteLabel = suiteError ? "ERROR" : suiteFailed ? "FAIL" : "PASS";
  if (suiteStats) {
    console.log(
      `${suiteLabel} ${file} — ${suiteStats.tests} tests: ${suiteStats.passed} passed, ${suiteStats.failed} failed, ${suiteStats.skipped} skipped, ${suiteStats.todo} todo, ${suiteStats.cancelled} cancelled`,
    );
  } else {
    console.log(`${suiteLabel} ${file} — no valid test summary`);
  }
}

console.log("\nWCatalog test summary");
console.log(`Suites discovered: ${testFiles.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Cancelled: ${cancelled}`);
console.log(`Skipped: ${skipped}`);
console.log(`Todo: ${todo}`);
console.log(`Errored before test summary: ${errored}`);
console.log(`Failed suites: ${failedSuites}`);
console.log("All suite DB URLs were assigned under the disposable root; provider credentials were not passed to child processes.");

cleanup();
process.removeListener("exit", cleanup);
if (failedSuites > 0 || failed > 0 || errored > 0) process.exitCode = 1;
