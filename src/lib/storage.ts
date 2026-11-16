import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export type SaveInput = {
  buffer: Buffer;
  contentType: string;
  ext: string;
  folder?: string;
};

export type SaveResult = {
  url: string;
  key: string;
};

export interface StorageProvider {
  name: string;
  save(input: SaveInput): Promise<SaveResult>;
}

/**
 * Local filesystem provider — fallback when neither Firebase Storage nor S3 is
 * configured. Writes to public/uploads and returns a relative URL.
 */
class LocalStorageProvider implements StorageProvider {
  name = "local";

  async save({ buffer, ext, folder }: SaveInput): Promise<SaveResult> {
    const cleanFolder = folder ? folder.replace(/[^a-z0-9/_-]/gi, "").replace(/^\/+|\/+$/g, "") : "";
    const filename = `${randomUUID()}.${ext}`;
    const key = cleanFolder ? `${cleanFolder}/${filename}` : filename;
    const targetDir = path.join(process.cwd(), "public", "uploads", ...(cleanFolder ? cleanFolder.split("/") : []));
    await mkdir(targetDir, { recursive: true });
    await writeFile(path.join(targetDir, filename), buffer);
    return { url: `/uploads/${key}`, key };
  }
}

/**
 * Firebase Cloud Storage provider (Google Cloud Storage for Firebase).
 *
 * Uses the official Firebase Storage v0 REST API with `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
 * (or `FIREBASE_STORAGE_BUCKET`) so it works on both Node.js and serverless runtimes
 * (Vercel) with zero native binary dependencies.
 *
 * Uploaded objects receive a permanent public download URL (`alt=media&token=...`)
 * suitable for `<img src>`, WhatsApp Cloud API media messages, Meta catalogs,
 * and downloadable documents.
 */
class FirebaseStorageProvider implements StorageProvider {
  name = "firebase";

  constructor(
    private bucket: string,
    private apiKey?: string,
  ) {}

  async save({ buffer, contentType, ext, folder }: SaveInput): Promise<SaveResult> {
    const cleanBucket = this.bucket.replace(/^gs:\/\//i, "").replace(/\/+$/, "").trim();
    const subFolder = folder
      ? folder.replace(/[^a-z0-9/_-]/gi, "").replace(/^\/+|\/+$/g, "")
      : "uploads";
    const key = `japora/${subFolder}/${randomUUID()}.${ext}`;

    const endpoint = new URL(
      `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(cleanBucket)}/o`,
    );
    endpoint.searchParams.set("uploadType", "media");
    endpoint.searchParams.set("name", key);
    if (this.apiKey) {
      endpoint.searchParams.set("key", this.apiKey);
    }

    const res = await fetch(endpoint.toString(), {
      method: "POST",
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `Firebase Storage upload failed (${res.status}): ${errText.slice(0, 300)}`,
      );
    }

    const meta = (await res.json().catch(() => ({}))) as {
      name?: string;
      bucket?: string;
      downloadTokens?: string;
    };

    const objectName = meta.name || key;
    const token = meta.downloadTokens?.split(",")[0]?.trim();
    const encodedPath = encodeURIComponent(objectName);
    const url = token
      ? `https://firebasestorage.googleapis.com/v0/b/${cleanBucket}/o/${encodedPath}?alt=media&token=${encodeURIComponent(token)}`
      : `https://firebasestorage.googleapis.com/v0/b/${cleanBucket}/o/${encodedPath}?alt=media`;

    return { url, key: objectName };
  }
}

/**
 * S3-compatible provider (AWS S3, Cloudflare R2, Supabase Storage).
 */
class S3StorageProvider implements StorageProvider {
  name = "s3";
  private clientPromise: Promise<{
    client: { send: (cmd: unknown) => Promise<unknown> };
    PutObjectCommand: new (input: unknown) => unknown;
  }> | null = null;

  constructor(
    private bucket: string,
    private publicUrlBase: string,
    private config: {
      region: string;
      endpoint?: string;
      accessKeyId: string;
      secretAccessKey: string;
    },
  ) {}

  private async getClient() {
    if (this.clientPromise) return this.clientPromise;
    this.clientPromise = (async () => {
      let sdk: typeof import("@aws-sdk/client-s3");
      try {
        sdk = await import("@aws-sdk/client-s3");
      } catch {
        throw new Error(
          "S3 storage is configured (STORAGE_S3_BUCKET is set) but the " +
            "@aws-sdk/client-s3 package is not installed. Run: pnpm add @aws-sdk/client-s3",
        );
      }
      const client = new sdk.S3Client({
        region: this.config.region,
        endpoint: this.config.endpoint || undefined,
        forcePathStyle: Boolean(this.config.endpoint),
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
      });
      return {
        client: client as unknown as { send: (cmd: unknown) => Promise<unknown> },
        PutObjectCommand: sdk.PutObjectCommand,
      };
    })();
    return this.clientPromise;
  }

  async save({ buffer, contentType, ext, folder }: SaveInput): Promise<SaveResult> {
    const { client, PutObjectCommand } = await this.getClient();
    const cleanFolder = folder ? folder.replace(/[^a-z0-9/_-]/gi, "").replace(/^\/+|\/+$/g, "") : "";
    const filename = `${randomUUID()}.${ext}`;
    const key = cleanFolder ? `${cleanFolder}/${filename}` : filename;
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    const base = this.publicUrlBase.replace(/\/$/, "");
    return { url: `${base}/${key}`, key };
  }
}

let cached: StorageProvider | null = null;

export function getFirebaseBucket(): string {
  return (
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    ""
  ).trim();
}

export function getStorageProvider(): StorageProvider {
  if (cached) return cached;

  const firebaseBucket = getFirebaseBucket();
  const firebaseApiKey = (
    process.env.FIREBASE_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    ""
  ).trim();

  if (firebaseBucket) {
    cached = new FirebaseStorageProvider(firebaseBucket, firebaseApiKey || undefined);
    return cached;
  }

  const bucket = process.env.STORAGE_S3_BUCKET;
  const accessKeyId = process.env.STORAGE_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_S3_SECRET_ACCESS_KEY;
  const publicUrl = process.env.STORAGE_S3_PUBLIC_URL;

  if (bucket && accessKeyId && secretAccessKey && publicUrl) {
    cached = new S3StorageProvider(bucket, publicUrl, {
      region: process.env.STORAGE_S3_REGION || "auto",
      endpoint: process.env.STORAGE_S3_ENDPOINT || undefined,
      accessKeyId,
      secretAccessKey,
    });
  } else {
    cached = new LocalStorageProvider();
  }
  return cached;
}

export function storageMode(): "firebase" | "s3" | "local" {
  if (getFirebaseBucket()) return "firebase";
  return process.env.STORAGE_S3_BUCKET ? "s3" : "local";
}
