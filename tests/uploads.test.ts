import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { getStorageProvider, uploadsDir } from "../src/lib/storage";
import { GET } from "../src/app/api/uploads/[key]/route";

let directory: string;
const previousDirectory = process.env.UPLOADS_DIR;

before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "japora-uploads-"));
  process.env.UPLOADS_DIR = directory;
});

after(async () => {
  if (previousDirectory === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = previousDirectory;
  if (directory) await rm(directory, { recursive: true, force: true });
});

function read(key: string) {
  return GET(new NextRequest("http://localhost/api/uploads/test"), { params: Promise.resolve({ key }) });
}

test("photos are saved and read from the configured persistent directory", async () => {
  assert.equal(uploadsDir(), directory);
  const buffer = Buffer.from("ci-image-bytes");
  const saved = await getStorageProvider().save({ buffer, contentType: "image/webp", ext: "webp" });
  assert.match(saved.url, /^\/uploads\/[a-f0-9-]+\.webp$/);
  const response = await read(saved.key);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/webp");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), buffer);
});

test("the photo endpoint refuses path traversal and non-image files", async () => {
  for (const key of ["../private.png", "..\\private.png", "file.txt", "file.svg", "file.png/extra"]) {
    assert.equal((await read(key)).status, 404, key);
  }
});

test("a missing photo returns 404", async () => {
  assert.equal((await read("missing-photo.webp")).status, 404);
});
