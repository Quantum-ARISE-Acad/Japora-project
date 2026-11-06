const summaryKeys = ["tests", "suites", "pass", "fail", "cancelled", "skipped", "todo", "duration_ms"] as const;

export type TapSummary = {
  tests: number;
  suites: number;
  passed: number;
  failed: number;
  cancelled: number;
  skipped: number;
  todo: number;
  durationMs: number;
};

export function parseTapSummary(output: string): TapSummary {
  const lines = output.split(/\r?\n/u);
  const testSummaryIndexes = lines.flatMap((line, index) => /^# tests\b/u.test(line) ? [index] : []);
  if (testSummaryIndexes.length !== 1) {
    throw new Error(`Expected exactly one TAP test summary; found ${testSummaryIndexes.length}.`);
  }
  if (lines.filter((line) => line === "TAP version 13").length !== 1) {
    throw new Error("Expected exactly one Node TAP version 13 header.");
  }

  const summaryStart = testSummaryIndexes[0];
  const footerLines = lines.slice(summaryStart).filter((line) => line.length > 0);
  if (footerLines.length !== summaryKeys.length) {
    throw new Error("TAP footer is incomplete or has trailing output.");
  }

  const allSummaryLines = lines.filter((line) => /^# (?:tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)\b/u.test(line));
  if (allSummaryLines.length !== summaryKeys.length) {
    throw new Error("TAP output contains missing or duplicated summary fields.");
  }

  const counts: Partial<Record<(typeof summaryKeys)[number], number>> = {};
  for (let index = 0; index < summaryKeys.length; index += 1) {
    const key = summaryKeys[index];
    const match = new RegExp(`^# ${key} (.+)$`, "u").exec(footerLines[index]);
    if (!match) throw new Error(`Malformed or out-of-order TAP summary field: ${key}`);

    const numericPattern = key === "duration_ms"
      ? /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu
      : /^(?:0|[1-9]\d*)$/u;
    if (!numericPattern.test(match[1])) throw new Error(`Invalid TAP summary value for ${key}: ${match[1]}`);
    const value = Number(match[1]);
    if (
      !Number.isFinite(value) ||
      (key === "duration_ms" ? value < 0 : !Number.isSafeInteger(value))
    ) {
      throw new Error(`Invalid TAP summary value for ${key}: ${match[1]}`);
    }
    counts[key] = value;
  }

  const tests = counts.tests!;
  const passed = counts.pass!;
  const failed = counts.fail!;
  const cancelled = counts.cancelled!;
  const skipped = counts.skipped!;
  const todo = counts.todo!;
  if (tests === 0) throw new Error("TAP summary reports no tests.");
  if (tests !== passed + failed + cancelled + skipped + todo) {
    throw new Error(
      `TAP outcome counts (${passed} passed, ${failed} failed, ${cancelled} cancelled, ${skipped} skipped, ${todo} todo) do not reconcile with ${tests} tests.`,
    );
  }

  return {
    tests,
    suites: counts.suites!,
    passed,
    failed,
    cancelled,
    skipped,
    todo,
    durationMs: counts.duration_ms!,
  };
}
