import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export type SaveInput = {
  buffer: Buffer;
  contentType: string;
  ext: string;
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
 * Local filesystem provider — the default. Writes to public/uploads and
 * returns a relative URL. Fine for a single Node host, broken on serverless
 * (the filesystem is ephemeral on Vercel/Lambda).
 */
class LocalStorageProvider implements StorageProvider {
  name = "local";

  async save({ buffer, ext }: SaveInput): Promise<SaveResult> {
    const key = `${randomUUID()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, key), buffer);
    return { url: `/uploads/${key}`, key };
  }
}

/**
 * S3-compatible provider. One implementation, three back-ends:
 *
 *   - AWS S3:           no endpoint, virtual-hosted addressing
 *   - Cloudflare R2:    endpoint = https://<account_id>.r2.cloudflarestorage.com
 *   - Supabase Storage  endpoint = https://<project>.supabase.co/storage/v1/s3
 *
 * The @aws-sdk/client-s3 package is loaded lazily — install it with
 * `pnpm add @aws-sdk/client-s3` to enable this provider. Until then,
 * getStorageProvider() falls back to LocalStorageProvider.
 *
 * STORAGE_S3_PUBLIC_URL is required so we can construct browser-reachable
 * image URLs (e.g. https://<bucket>.s3.<region>.amazonaws.com for AWS,
 * https://pub-<hash>.r2.dev for R2, or
 * https://<project>.supabase.co/storage/v1/object/public/<bucket> for Supabase).
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
        // AWS S3 uses virtual-hosted addressing by default; R2 + Supabase
        // need path-style. "endpoint set => not AWS => path style" covers all three.
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

  async save({ buffer, contentType, ext }: SaveInput): Promise<SaveResult> {
    const { client, PutObjectCommand } = await this.getClient();
    const key = `${randomUUID()}.${ext}`;
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

export function getStorageProvider(): StorageProvider {
  if (cached) return cached;

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

export function storageMode(): "local" | "s3" {
  return process.env.STORAGE_S3_BUCKET ? "s3" : "local";
}
