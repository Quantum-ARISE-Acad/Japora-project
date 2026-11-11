// Minimal ambient declaration for sharp so the build doesn't require the
// native package to be installed. Lazy-loaded in src/lib/image.ts — if sharp
// isn't on disk, the upload route passes images through unchanged.
declare module "sharp" {
  interface SharpInstance {
    rotate(): SharpInstance;
    resize(opts: {
      width?: number;
      height?: number;
      fit?: "cover" | "contain" | "fill" | "inside" | "outside";
      withoutEnlargement?: boolean;
    }): SharpInstance;
    jpeg(opts?: { quality?: number }): SharpInstance;
    png(opts?: { compressionLevel?: number }): SharpInstance;
    webp(opts?: { quality?: number }): SharpInstance;
    toBuffer(): Promise<Buffer>;
  }
  function sharp(input: Buffer): SharpInstance;
  export = sharp;
}
