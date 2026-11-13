#!/usr/bin/env node
// Stage 4 · CI result: reads `toJSON(needs)` on stdin and fails unless every job succeeded.
const needs = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
let ok = Object.keys(needs).length > 0;
for (const [job, r] of Object.entries(needs)) {
  console.log(`${r.result === "success" ? "OK    " : "ECHEC "} ${job}: ${r.result}`);
  if (r.result !== "success") ok = false;
}
process.exit(ok ? 0 : 1);
