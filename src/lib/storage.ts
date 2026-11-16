import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { logger } from "./logger";

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
 * Folder where uploaded photos live. Set UPLOADS_DIR to a persistent folder
 * (a Docker volume, a disk outside the build) so photos survive a site update.
 * Defaults to ./public/uploads for local development.
 */
export function uploadsDir(): string {
  const configured = process.env.UPLOADS_DIR?.trim();
  return configured ? path.resolve(configured) : path.join(process.cwd(), "public", "uploads");
}

/**
 * Local filesystem provider — the default. Writes to uploadsDir() and returns
 * a relative /uploads/<key> URL, served by /api/uploads/<key> (a production
 * Next.js server does not serve files added to public/ after the build).
 * Fine for a single Node host, broken on serverless (ephemeral filesystem).
 */
class LocalStorageProvider implements StorageProvider {
  name = "local";

  async save({ buffer, ext }: SaveInput): Promise<SaveResult> {
    const key = `${randomUUID()}.${ext}`;
    const dir = uploadsDir();
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
 * the upload fails with a clear message in the logs.
 *
 * STORAGE_S3_PUBLIC_URL is required so we can construct browser-reachable
 * image URLs (e.g. https://<bucket>.s3.<region>.amazonaws.com for AWS,
 * https://pub-<hash>.r2.dev for R2, or
 * https://<project>.supabase.co/storage/v1/object/public/<bucket> for Supabase).
 */
export class S3StorageProvider implements StorageProvider {
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
      } catch (e) {
        // Optional dependency: npm skips it on Node < 20 (the production image runs Node 20).
        throw new Error(
          "S3 storage is configured but @aws-sdk/client-s3 could not be loaded " +
            `(Node ${process.versions.node}; it needs Node 20+ and npm ci): ` +
            (e instanceof Error ? e.message : String(e)),
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

  /** Upload under a chosen key (the photo migration keeps the local file name). */
  async put(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const { client, PutObjectCommand } = await this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return this.publicUrl(key);
  }

  publicUrl(key: string): string {
    return `${this.publicUrlBase.replace(/\/$/, "")}/${key}`;
  }

  async save({ buffer, contentType, ext }: SaveInput): Promise<SaveResult> {
    const key = `${randomUUID()}.${ext}`;
    const url = await this.put(key, buffer, contentType);
    return { url, key };
  }
}

/** The six STORAGE_S3_* settings; `missing` lists the required ones left blank. */
export function s3Settings(env: Record<string, string | undefined> = process.env) {
  const v = (name: string) => (env[name] || "").trim();
  const settings = {
    bucket: v("STORAGE_S3_BUCKET"),
    accessKeyId: v("STORAGE_S3_ACCESS_KEY_ID"),
    secretAccessKey: v("STORAGE_S3_SECRET_ACCESS_KEY"),
    publicUrl: v("STORAGE_S3_PUBLIC_URL"),
    region: v("STORAGE_S3_REGION") || "auto",
    endpoint: v("STORAGE_S3_ENDPOINT"),
  };
  const required: Array<[string, string]> = [
    ["STORAGE_S3_BUCKET", settings.bucket],
    ["STORAGE_S3_ACCESS_KEY_ID", settings.accessKeyId],
    ["STORAGE_S3_SECRET_ACCESS_KEY", settings.secretAccessKey],
    ["STORAGE_S3_PUBLIC_URL", settings.publicUrl],
  ];
  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  return { ...settings, missing };
}

/** The S3 provider, or null when the settings are incomplete. */
export function createS3Provider(env: Record<string, string | undefined> = process.env): S3StorageProvider | null {
  const s = s3Settings(env);
  if (s.missing.length) return null;
  return new S3StorageProvider(s.bucket, s.publicUrl, {
    region: s.region,
    endpoint: s.endpoint || undefined,
    accessKeyId: s.accessKeyId,
    secretAccessKey: s.secretAccessKey,
  });
}

/**
 * The file name of a photo stored on this server ("/uploads/<key>" or
 * "https://<site>/uploads/<key>"), or null for anything else (an S3 link,
 * an outside link, an empty value).
 */
export function localUploadKey(url: string, appUrl = ""): string | null {
  let u = (url || "").trim();
  const site = appUrl.trim().replace(/\/$/, "");
  if (site && u.startsWith(`${site}/`)) u = u.slice(site.length);
  const m = u.match(/^\/uploads\/([A-Za-z0-9][A-Za-z0-9._-]*)$/);
  return m && !m[1].includes("..") ? m[1] : null;
}

let cached: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (cached) return cached;
  const s3 = createS3Provider();
  if (s3) {
    cached = s3;
  } else {
    const { bucket, missing } = s3Settings();
    if (bucket) {
      // Half-configured: keep photos working on this server, but say why.
      logger.error("storage.s3_incomplete", { missing });
    }
    cached = new LocalStorageProvider();
  }
  return cached;
}

/** "incomplete": a bucket is set but other required settings are blank (photos stay local). */
export function storageMode(): "local" | "s3" | "incomplete" {
  const { bucket, missing } = s3Settings();
  if (!bucket) return "local";
  return missing.length ? "incomplete" : "s3";
}

/** Required S3 settings left blank, for the settings page. */
export function storageMissingSettings(): string[] {
  const { bucket, missing } = s3Settings();
  return bucket ? missing : [];
}
