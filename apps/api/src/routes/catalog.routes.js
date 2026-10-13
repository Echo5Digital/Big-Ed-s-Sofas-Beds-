const express = require("express");
const { prisma } = require("@big-eds/database");
const { productCreateSchema, productUpdateSchema, categoryCreateSchema } = require("@big-eds/validation");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { NotFoundError } = require("../lib/errors");

const router = express.Router();

const PRODUCT_INCLUDE = {
  category: true,
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
    status: product.status,
    category: product.category ? { id: product.category.id, name: product.category.name, slug: product.category.slug } : null,
    images: product.images.map((img) => ({ id: img.id, url: img.url, altText: img.altText })),
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
      ...(category ? { category: { slug: category } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: String(q), mode: "insensitive" } },
              { description: { contains: String(q), mode: "insensitive" } },
            ],
          }
        : {}),
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
  "/products",
  requireAuth,
  requirePermission("catalog:write"),
  validateBody(productCreateSchema),
  asyncHandler(async (req, res) => {
    const { variants, ...productData } = req.body;

    const product = await prisma.product.create({
      data: {
        ...productData,
        variants: { create: variants },
      },
      include: PRODUCT_INCLUDE,
    });

    res.status(201).json({ product: serializeProduct(product) });
  })
);

router.patch(
  "/products/:id",
  requireAuth,
  requirePermission("catalog:write"),
  validateBody(productUpdateSchema),
  asyncHandler(async (req, res) => {
    const { variants, ...productData } = req.body;

    if (variants) {
      // Partial updates only: adjust price/details on existing variants by
      // SKU. Adding or removing variants on an existing product is not
      // supported through this endpoint — that's a deliberately separate,
      // more careful operation since it has stock/order-history implications.
      await Promise.all(
        variants
          .filter((v) => v.sku)
          .map((v) =>
            prisma.variant.updateMany({
              where: { productId: req.params.id, sku: v.sku },
              data: v,
            })
          )
      );
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: productData,
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
