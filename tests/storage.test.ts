import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createS3Provider, localUploadKey, s3Settings } from "../src/lib/storage";

const full = {
  STORAGE_S3_BUCKET: "japora-photos",
  STORAGE_S3_ACCESS_KEY_ID: "id",
  STORAGE_S3_SECRET_ACCESS_KEY: "secret",
  STORAGE_S3_PUBLIC_URL: "https://photos.example.com/",
  STORAGE_S3_ENDPOINT: "https://acc.r2.cloudflarestorage.com",
};

describe("photo storage", () => {
  test("complete R2 settings give an S3 provider with public links", () => {
    const p = createS3Provider(full);
    assert.ok(p);
    assert.equal(p.publicUrl("abc.webp"), "https://photos.example.com/abc.webp");
    assert.deepEqual(s3Settings(full).missing, []);
  });

  test("incomplete settings name what is missing and give no provider", () => {
    const env = { ...full, STORAGE_S3_PUBLIC_URL: " ", STORAGE_S3_SECRET_ACCESS_KEY: "" };
    assert.deepEqual(s3Settings(env).missing, ["STORAGE_S3_SECRET_ACCESS_KEY", "STORAGE_S3_PUBLIC_URL"]);
    assert.equal(createS3Provider(env), null);
  });

  test("only photos stored on this server are moved", () => {
    assert.equal(localUploadKey("/uploads/1f2e.webp"), "1f2e.webp");
    assert.equal(localUploadKey("https://japora.tg/uploads/1f2e.jpg", "https://japora.tg/"), "1f2e.jpg");
    assert.equal(localUploadKey("https://photos.example.com/1f2e.jpg", "https://japora.tg"), null);
    assert.equal(localUploadKey("https://ailleurs.com/uploads/x.jpg", "https://japora.tg"), null);
    assert.equal(localUploadKey("/uploads/../.env"), null);
    assert.equal(localUploadKey("/uploads/a/b.jpg"), null);
    assert.equal(localUploadKey(""), null);
  });
});
