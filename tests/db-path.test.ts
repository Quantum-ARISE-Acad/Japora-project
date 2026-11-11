import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { assertIsolatedTestDatabase, resolveDatabaseUrl } from "../src/lib/db";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));

test("relative SQLite URLs resolve deterministically without accessing a database", () => {
  const resolved = resolveDatabaseUrl("file:./prisma/test-fixture.db", workspaceRoot);

  assert.equal(resolved, `file:${path.join(workspaceRoot, "prisma", "test-fixture.db")}`);
});

test("an empty DATABASE_URL resolves to the documented default without opening it", () => {
  const resolved = resolveDatabaseUrl("", workspaceRoot);

  assert.equal(resolved, `file:${path.join(workspaceRoot, "prisma", "dev.db")}`);
});

test("test database guard accepts only a file below the disposable temporary root", () => {
  const testRoot = process.env.WATURU_TEST_DB_ROOT;
  assert.ok(testRoot);
  assert.doesNotThrow(() => assertIsolatedTestDatabase(`file:${path.join(testRoot!, "suite", "test.db")}`));
  assert.throws(() => assertIsolatedTestDatabase("file:/tmp/wcatalog-outside-test-root.db"));
  assert.throws(() => assertIsolatedTestDatabase("postgresql://localhost/wcatalog"));
});
