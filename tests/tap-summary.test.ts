import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTapSummary } from "../scripts/tap-summary";

function tapFooter(fields: string[]): string {
  return ["TAP version 13", "1..1", ...fields].join("\n");
}

const validFooter = tapFooter([
  "# tests 3",
  "# suites 1",
  "# pass 1",
  "# fail 0",
  "# cancelled 0",
  "# skipped 1",
  "# todo 1",
  "# duration_ms 12.5",
]);

test("parses Node TAP totals, counting skipped and TODO as separate outcomes", () => {
  assert.deepEqual(parseTapSummary(validFooter), {
    tests: 3,
    suites: 1,
    passed: 1,
    failed: 0,
    cancelled: 0,
    skipped: 1,
    todo: 1,
    durationMs: 12.5,
  });
});

test("rejects a missing, malformed, duplicated, or out-of-order footer field", () => {
  assert.throws(() => parseTapSummary(validFooter.replace("# todo 1\n", "")), /incomplete|missing/i);
  assert.throws(() => parseTapSummary(validFooter.replace("# pass 1", "# pass one")), /invalid|malformed/i);
  assert.throws(() => parseTapSummary(validFooter.replace("# todo 1", "# todo 1\n# todo 1")), /duplicated|exactly one|trailing/i);
  assert.throws(() => parseTapSummary(validFooter.replace("# fail 0\n# cancelled 0", "# cancelled 0\n# fail 0")), /out-of-order/i);
});

test("rejects zero tests and outcome totals that do not reconcile", () => {
  assert.throws(() => parseTapSummary(validFooter.replace("# tests 3", "# tests 0")), /no tests/i);
  assert.throws(() => parseTapSummary(validFooter.replace("# tests 3", "# tests 4")), /do not reconcile/i);
});

test("rejects multiple summaries and output after the footer", () => {
  assert.throws(() => parseTapSummary(`${validFooter}\n${validFooter}`), /exactly one/i);
  assert.throws(() => parseTapSummary(`${validFooter}\nextra output`), /trailing output/i);
});
