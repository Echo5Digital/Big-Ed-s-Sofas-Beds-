const express = require("express");
const multer = require("multer");
const { prisma } = require("@big-eds/database");
const { productCreateSchema, productUpdateSchema, categoryCreateSchema } = require("@big-eds/validation");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { NotFoundError, ValidationError } = require("../lib/errors");
const cloudinary = require("../lib/cloudinary");

const router = express.Router();

// Admin-uploaded product images are stored in Cloudinary (not local disk —
// local disk is ephemeral on most production hosts and is wiped on redeploy).
// Multer here only buffers the multipart upload in memory before it's
// streamed on to Cloudinary; nothing is written to the local filesystem.
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return cb(new ValidationError({ file: "Only JPEG, PNG, WebP, or GIF images are allowed" }));
    }
    cb(null, true);
  },
});

function uploadBufferToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "products", resource_type: "image" },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

const PRODUCT_INCLUDE = {
  category: true,
  categoryTags: { include: { category: true } },
  images: { orderBy: { sortOrder: "asc" } },
  variants: {
    include: {
      stockBalances: { include: { location: true } },
    },
  },
};

function computeAvailability(variant) {
  const byLocation = variant.stockBalances.map((sb) => ({
    locationId: sb.locationId,
    locationName: sb.location.name,
    locationType: sb.location.type,
    onHand: sb.onHand,
    reserved: sb.reserved,
    quarantined: sb.quarantined,
    availableToSell: Math.max(0, sb.onHand - sb.reserved - sb.quarantined),
  }));
  const totalAvailable = byLocation.reduce((sum, l) => sum + l.availableToSell, 0);
  return { byLocation, totalAvailable };
}

function serializeProduct(product) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    brand: product.brand,
    itemName: product.itemName,
    color: product.color,
    material: product.material,
    dimensions: product.dimensions,
    status: product.status,
    category: product.category ? { id: product.category.id, name: product.category.name, slug: product.category.slug } : null,
    categories: (product.categoryTags ?? []).map((tag) => ({
      id: tag.category.id,
      name: tag.category.name,
      slug: tag.category.slug,
    })),
    images: product.images.map((img) => ({ id: img.id, url: img.url, publicId: img.publicId, altText: img.altText })),
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      color: v.color,
      size: v.size,
      dimensions: {
        widthInches: v.widthInches,
        heightInches: v.heightInches,
        depthInches: v.depthInches,
        weightLbs: v.weightLbs,
      },
      priceCents: v.priceCents,
      compareAtCents: v.compareAtCents,
      isActive: v.isActive,
      availability: computeAvailability(v),
    })),
  };
}

// --- Public (storefront) ---------------------------------------------------

router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
    });
    res.json({ categories });
  })
);

router.get(
  "/products",
  asyncHandler(async (req, res) => {
    const { category, status, q, page = "1", pageSize = "24" } = req.query;

    const where = {
      ...(status ? { status } : { status: "ACTIVE" }),
      AND: [
        ...(category
          ? [{ OR: [{ category: { slug: category } }, { categoryTags: { some: { category: { slug: category } } } }] }]
          : []),
        ...(q
          ? [
              {
                OR: [
                  { name: { contains: String(q), mode: "insensitive" } },
                  { description: { contains: String(q), mode: "insensitive" } },
                ],
              },
            ]
          : []),
      ],
    };

    const take = Math.min(100, Number(pageSize) || 24);
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products: products.map(serializeProduct),
      pagination: { page: Number(page) || 1, pageSize: take, total },
    });
  })
);

router.get(
  "/products/:slug",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundError("Product not found");
    res.json({ product: serializeProduct(product) });
  })
);

// --- Staff (admin) -----------------------------------------------------

router.post(
  "/categories",
  requireAuth,
  requirePermission("catalog:write"),
  validateBody(categoryCreateSchema),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.create({ data: req.body });
    res.status(201).json({ category });
  })
);

router.patch(
  "/categories/:id",
  requireAuth,
  requirePermission("catalog:write"),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ category });
  })
);

router.post(
  "/admin/images",
  requireAuth,
  requirePermission("catalog:write"),
  upload.array("images", 10),
  asyncHandler(async (req, res) => {
    const files = req.files || [];
    if (files.length === 0) {
      throw new ValidationError({ images: "At least one image file is required" });
    }
    const uploaded = await Promise.all(files.map((file) => uploadBufferToCloudinary(file.buffer)));
    const images = uploaded.map((result) => ({
      url: result.secure_url,
      publicId: result.public_id,
      altText: null,
    }));
    res.status(201).json({ images });
  })
);

router.post(
  "/products",
  requireAuth,
  requirePermission("catalog:write"),
  validateBody(productCreateSchema),
  asyncHandler(async (req, res) => {
    const { variants, images, categoryIds, ...productData } = req.body;
    // Secondary categories are purely additive to the primary categoryId —
    // dedupe so the same category never appears as both, which would violate
    // the ProductCategory composite primary key.
    const secondaryCategoryIds = (categoryIds ?? []).filter((id) => id !== productData.categoryId);

    const product = await prisma.product.create({
      data: {
        ...productData,
        variants: { create: variants },
        images: images ? { create: images.map((img, i) => ({ ...img, sortOrder: i })) } : undefined,
        categoryTags: secondaryCategoryIds.length
          ? { create: secondaryCategoryIds.map((categoryId) => ({ categoryId })) }
          : undefined,
      },
      include: PRODUCT_INCLUDE,
    });

    // Every variant needs a StockBalance row to show up on the Inventory
    // page at all — without one there's nothing for a manager to "Adjust"
    // stock against. This creates the row at onHand: 0 only; it is not a
    // stock receipt (no StockMovement is written), so a brand-new product
    // correctly stays "out of stock" until someone actually receives it.
    const locations = await prisma.location.findMany({ where: { isActive: true }, select: { id: true } });
    if (locations.length > 0) {
      await prisma.stockBalance.createMany({
        data: product.variants.flatMap((v) => locations.map((loc) => ({ variantId: v.id, locationId: loc.id }))),
        skipDuplicates: true,
      });
    }

    res.status(201).json({ product: serializeProduct(product) });
  })
);

router.patch(
  "/products/:id",
  requireAuth,
  requirePermission("catalog:write"),
  validateBody(productUpdateSchema),
  asyncHandler(async (req, res) => {
    const { variants, images, categoryIds, ...productData } = req.body;

    if (variants) {
      // Partial updates only: adjust price/sku/details on existing variants,
      // matched by id. Adding or removing variants on an existing product is
      // not supported through this endpoint — that's a deliberately separate,
      // more careful operation since it has stock/order-history implications.
      //
      // Must match by id, not sku: sku is itself an editable field here, so
      // matching on the newly submitted sku can never find the existing row
      // once it's been changed, silently dropping the update.
      await Promise.all(
        variants
          .filter((v) => v.id)
          .map(({ id, ...data }) =>
            prisma.variant.updateMany({
              where: { productId: req.params.id, id },
              data,
            })
          )
      );
    }

    if (images) {
      // Full replace: the admin form always submits the complete current
      // image list in display order, so sortOrder is recomputed from array
      // position rather than merged with existing rows.
      await prisma.productImage.deleteMany({ where: { productId: req.params.id } });
    }

    if (categoryIds) {
      const secondaryCategoryIds = categoryIds.filter((id) => id !== (productData.categoryId ?? null));
      await prisma.productCategory.deleteMany({ where: { productId: req.params.id } });
      if (secondaryCategoryIds.length) {
        await prisma.productCategory.createMany({
          data: secondaryCategoryIds.map((categoryId) => ({ productId: req.params.id, categoryId })),
        });
      }
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...productData,
        images: images ? { create: images.map((img, i) => ({ ...img, sortOrder: i })) } : undefined,
      },
      include: PRODUCT_INCLUDE,
    });

    res.json({ product: serializeProduct(product) });
  })
);

router.get(
  "/admin/products",
  requireAuth,
  requirePermission("catalog:read"),
  asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany({
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    res.json({ products: products.map(serializeProduct) });
  })
);

module.exports = router;
