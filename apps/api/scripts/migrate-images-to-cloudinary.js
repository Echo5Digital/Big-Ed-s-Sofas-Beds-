// One-off migration: upload the admin-uploaded product images that still
// live on local disk (apps/api/uploads/products/) to Cloudinary, then update
// each ProductImage row's url/publicId to point at the new Cloudinary asset.
//
// Only touches rows whose url references /uploads/products/ AND whose file
// actually exists on this machine's disk. Rows referencing files that don't
// exist here (already broken before this migration — uploaded from a
// different machine/session) are left untouched and reported, not modified,
// since there is nothing to migrate them from.
//
// Run with: node apps/api/scripts/migrate-images-to-cloudinary.js
const fs = require("fs");
const path = require("path");
const { prisma } = require("@big-eds/database");
const cloudinary = require("../src/lib/cloudinary");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "products");

async function main() {
  const rows = await prisma.productImage.findMany({
    where: { url: { contains: "/uploads/products/" } },
  });

  const migratable = [];
  const missing = [];
  for (const row of rows) {
    const filename = row.url.split("/uploads/products/")[1];
    const filePath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(filePath)) {
      migratable.push({ row, filePath });
    } else {
      missing.push(row);
    }
  }

  console.log(`Found ${rows.length} image row(s) referencing local uploads.`);
  console.log(`  ${migratable.length} have a file on disk and will be migrated.`);
  console.log(`  ${missing.length} reference a file that does not exist here and will be left untouched:`);
  for (const row of missing) {
    console.log(`    - ProductImage ${row.id} (product ${row.productId}): ${row.url}`);
  }

  for (const { row, filePath } of migratable) {
    const result = await cloudinary.uploader.upload(filePath, { folder: "products", resource_type: "image" });
    await prisma.productImage.update({
      where: { id: row.id },
      data: { url: result.secure_url, publicId: result.public_id },
    });
    console.log(`Migrated ${row.id}: ${row.url} -> ${result.secure_url}`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
