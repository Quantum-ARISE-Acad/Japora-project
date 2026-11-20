/**
 * Copy the photos stored on this server (UPLOADS_DIR) to the S3 / R2 bucket,
 * then point the products and shop pictures to their new address.
 *
 *   npx tsx scripts/migrate-uploads-to-s3.ts           # dry run: shows what would change
 *   npx tsx scripts/migrate-uploads-to-s3.ts --apply   # copies and updates the database
 *
 * Safe to run again: each photo keeps its file name, so a second run uploads
 * the same files again and finds nothing left to update. Local files are never
 * deleted: they stay in the server backups until you remove them yourself.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { createS3Provider, localUploadKey, s3Settings, uploadsDir } from "../src/lib/storage";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

async function main() {
  const apply = process.argv.includes("--apply");
  const provider = createS3Provider();
  if (!provider) {
    console.error(`Stockage externe non configuré. Réglages manquants : ${s3Settings().missing.join(", ")}`);
    process.exit(1);
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const dir = uploadsDir();
  console.log(apply ? "Mode : copie réelle (--apply)" : "Mode : essai (rien n'est modifié, ajoutez --apply)");
  console.log(`Dossier des photos : ${dir}`);

  // 1. Copy every photo file to the bucket, keeping its name.
  const names = await readdir(dir).catch(() => [] as string[]);
  const copied = new Map<string, string>();
  let failed = 0;
  for (const name of names) {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    const contentType = CONTENT_TYPES[ext];
    if (!contentType || localUploadKey(`/uploads/${name}`) !== name) continue;
    const file = path.join(dir, name);
    if (!(await stat(file)).isFile()) continue;
    if (!apply) {
      copied.set(name, provider.publicUrl(name));
      continue;
    }
    try {
      copied.set(name, await provider.put(name, await readFile(file), contentType));
    } catch (e) {
      failed++;
      console.error(`ECHEC ${name} : ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`Photos ${apply ? "copiées" : "à copier"} : ${copied.size}${failed ? `, échecs : ${failed}` : ""}`);

  // 2. Point the database to the new addresses (only for photos that were copied).
  const products = await prisma.product.findMany({
    where: { imageUrl: { contains: "/uploads/" } },
    select: { id: true, imageUrl: true },
  });
  const vendors = await prisma.vendor.findMany({
    where: { avatarUrl: { contains: "/uploads/" } },
    select: { id: true, avatarUrl: true },
  });
  let productUpdates = 0;
  let vendorUpdates = 0;
  const missing = new Set<string>();
  for (const p of products) {
    const key = localUploadKey(p.imageUrl, appUrl);
    if (!key) continue;
    const url = copied.get(key);
    if (!url) {
      missing.add(key);
      continue;
    }
    if (apply) await prisma.product.update({ where: { id: p.id }, data: { imageUrl: url } });
    productUpdates++;
  }
  for (const v of vendors) {
    const key = localUploadKey(v.avatarUrl, appUrl);
    if (!key) continue;
    const url = copied.get(key);
    if (!url) {
      missing.add(key);
      continue;
    }
    if (apply) await prisma.vendor.update({ where: { id: v.id }, data: { avatarUrl: url } });
    vendorUpdates++;
  }
  console.log(`Produits ${apply ? "mis à jour" : "à mettre à jour"} : ${productUpdates}`);
  console.log(`Photos de boutique ${apply ? "mises à jour" : "à mettre à jour"} : ${vendorUpdates}`);
  if (missing.size) {
    console.log(`Liens laissés tels quels (fichier introuvable sur le serveur) : ${missing.size}`);
  }
  await prisma.$disconnect();
  if (failed) process.exit(2);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
