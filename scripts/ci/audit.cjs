#!/usr/bin/env node
/**
 * Dependency audit gate for CI.
 *
 * Fails on any high or critical advisory affecting production dependencies,
 * except the ones listed in .github/ci/audit-allowlist.json. Every exception
 * carries a reason and an expiry date: once expired, the build fails again so
 * the exception cannot be forgotten.
 *
 * Usage: node scripts/ci/audit.cjs [path/to/npm-audit.json]
 * Without an argument, runs `npm audit --omit=dev --json` itself.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const BLOCKING = new Set(["high", "critical"]);
const root = path.resolve(__dirname, "..", "..");
const allowlistPath = path.join(root, ".github", "ci", "audit-allowlist.json");

function readAudit() {
  const file = process.argv[2];
  if (file) return JSON.parse(fs.readFileSync(file, "utf8"));
  try {
    return JSON.parse(execFileSync("npm", ["audit", "--omit=dev", "--json"], { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 }));
  } catch (error) {
    // npm audit exits non-zero when it finds anything; its JSON is still on stdout.
    if (error.stdout) return JSON.parse(error.stdout);
    throw error;
  }
}

const audit = readAudit();
if (audit.error) {
  console.error("npm audit failed:", audit.error.summary || audit.error);
  process.exit(2);
}

const allowlist = JSON.parse(fs.readFileSync(allowlistPath, "utf8")).advisories;
const today = new Date().toISOString().slice(0, 10);
const allowed = new Map(allowlist.map((a) => [a.id, a]));

// Collect each advisory once, with the packages it reaches.
const advisories = new Map();
for (const [pkg, vuln] of Object.entries(audit.vulnerabilities || {})) {
  for (const via of vuln.via) {
    if (typeof via !== "object" || !via.url) continue;
    const id = via.url.split("/").pop();
    const entry = advisories.get(id) || { id, severity: via.severity, title: via.title, packages: new Set() };
    entry.packages.add(pkg);
    advisories.set(id, entry);
  }
}

const blocking = [];
const accepted = [];
const expired = [];
for (const a of advisories.values()) {
  if (!BLOCKING.has(a.severity)) continue;
  const exception = allowed.get(a.id);
  if (!exception) blocking.push(a);
  else if (exception.expires < today) expired.push({ ...a, exception });
  else accepted.push({ ...a, exception });
}

const line = (a) => `  [${a.severity}] ${a.id} ${[...a.packages].join(", ")} — ${a.title}`;
if (accepted.length) {
  console.log("Accepted temporarily (see .github/ci/audit-allowlist.json):");
  for (const a of accepted) console.log(`${line(a)}\n      until ${a.exception.expires}: ${a.exception.reason}`);
}
const unused = allowlist.filter((a) => !advisories.has(a.id));
if (unused.length) console.log(`Exceptions no longer needed (remove them): ${unused.map((a) => a.id).join(", ")}`);

if (expired.length) {
  console.error("Expired exceptions — fix the dependency or renew the decision:");
  for (const a of expired) console.error(`${line(a)}\n      expired ${a.exception.expires}`);
}
if (blocking.length) {
  console.error("High/critical vulnerabilities in production dependencies:");
  for (const a of blocking) console.error(line(a));
  console.error("Fix with `npm audit fix` (or a version bump), or add a dated, justified exception.");
}
if (blocking.length || expired.length) process.exit(1);
console.log(`Dependency audit passed: no unaccepted high/critical advisory (${advisories.size} advisories seen in total).`);
