-- A cover image for each collection (Seth's collections page).
ALTER TABLE "Collection" ADD COLUMN "imageUrl" TEXT NOT NULL DEFAULT '';
