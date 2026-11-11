// Minimal ambient declaration for @aws-sdk/client-s3 so the build doesn't
// require the package to be installed. The S3 storage provider only loads
// the real module at runtime via a dynamic import — when the package is
// missing, getStorageProvider() falls back to local filesystem storage.
declare module "@aws-sdk/client-s3" {
  export class S3Client {
    constructor(config: unknown);
    send(command: unknown): Promise<unknown>;
  }
  export class PutObjectCommand {
    constructor(input: unknown);
  }
}
