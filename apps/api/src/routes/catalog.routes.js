const express = require("express");
const multer = require("multer");
const { prisma } = require("@big-eds/database");
const { productCreateSchema, productUpdateSchema, categoryCreateSchema } = require("@big-eds/validation");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { NotFoundError, ValidationError } = require("../lib/errors");
const cloudinary = require("../lib/cloudinary");
const inventoryService = require("../services/inventory.service");

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

// linkedTo (see ProductLink in schema.prisma) resolves each cross-linked
// Product just enough to render a storefront card and an admin "currently
// linked" chip — slug/name/first image/first-variant price, NOT the full
// stockBalances-per-location/every-image shape the main product gets below.
// This matters because PRODUCT_INCLUDE is also used by GET /admin/products,
// which lists the WHOLE catalog at once (no pagination yet) — giving every
// linked product its own full nested stock/image join here would multiply
// that query's cost by however many links exist, for data no admin list or
// product-card view actually needs (storefront cards only show one image and
// one price; the admin picker only needs enough to show what's already
// linked, not full availability).
const PRODUCT_INCLUDE = {
  category: true,
  categoryTags: { include: { category: true } },
  images: { orderBy: { sortOrder: "asc" } },
  variants: {
    include: {
      stockBalances: { include: { location: true } },
    },
  },
  linkedTo: {
    include: {
      linkedProduct: {
        select: {
          id: true,
          slug: true,
          name: true,
          images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
          // Not take: 1 — the storefront picks the first ACTIVE variant for
          // card display (normalizeProductForCard), not just the first
          // created one, so a handful need to come along for it to pick from
          // correctly. Still bounded (not every variant on every link, which
          // for a single-variant product — the normal case today — is the
          // same one row either way).
          variants: {
            orderBy: { createdAt: "asc" },
            take: 5,
            select: {
              id: true,
              sku: true,
              priceCents: true,
              compareAtCents: true,
              isActive: true,
              // Needed so a linked product's storefront card can show a real
              // "Out of Stock" badge instead of a false one
              // (computeAvailability defaults to 0 when this is missing,
              // which would otherwise mislabel an in-stock linked product).
              stockBalances: { include: { location: true } },
            },
          },
        },
      },
    },
  },
};

// POS's product search (apps/pos/components/checkout/ProductSearch.jsx) only
// ever reads variant sku/name/price/availability — it never shows images,
// category, or description. Those extra relations are real Prisma-level
// round trips (category, categoryTags+category, images) and real
// over-the-wire payload (full Cloudinary URLs/alt text for every image on
// every product) that POS fetches and immediately discards on every
// debounced keystroke. ?fields=minimal skips them; every other caller
// (storefront) is unaffected and keeps the full default shape.
const PRODUCT_INCLUDE_MINIMAL = {
  variants: {
    include: {
      stockBalances: { include: { location: true } },
    },
  },
};

function serializeProductMinimal(product) {
  return {
    id: product.id,
    name: product.name,
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      priceCents: v.priceCents,
      compareAtCents: v.compareAtCents,
      isActive: v.isActive,
      availability: computeAvailability(v),
    })),
  };
}

// The admin product list's Category column should show the most specific
// (deepest) category a product belongs to, not necessarily whichever one
// happens to be the primary categoryId — admins can check a parent and a
// child together, and "primary" is just whichever was checked first (see
// apps/admin/components/products/CategoryMultiSelect.jsx). A category with a
// parentId is a subcategory; prefer the first subcategory found among the
// primary + secondary tags, falling back to the primary category.
function pickDisplayCategory(product) {
  const candidates = [
    ...(product.category ? [product.category] : []),
    ...(product.categoryTags ?? []).map((tag) => tag.category),
  ];
  const subcategory = candidates.find((c) => c.parentId);
  const chosen = subcategory ?? candidates[0] ?? null;
  return chosen ? { id: chosen.id, name: chosen.name, slug: chosen.slug } : null;
}

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
    isDeal: product.isDeal,
    category: product.category ? { id: product.category.id, name: product.category.name, slug: product.category.slug } : null,
    displayCategory: pickDisplayCategory(product),
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
    // Other, independently-sellable Products this one cross-links to (see
    // ProductLink in schema.prisma) — NOT this product's own color/size
    // variants, which are the `variants` array above. Each entry is the same
    // {id, slug, name, images, variants} shape as a normal product list item
    // (minus category — PRODUCT_INCLUDE's nested linkedTo.linkedProduct
    // doesn't fetch it, since the storefront only needs slug/image/price/sku
    // to render a card and link to the linked product's own page), so
    // existing card-normalizing code can consume it unchanged.
    linkedProducts: (product.linkedTo ?? []).map(({ linkedProduct: lp }) => ({
      id: lp.id,
      slug: lp.slug,
      name: lp.name,
      images: lp.images.map((img) => ({ url: img.url })),
      variants: lp.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        priceCents: v.priceCents,
        compareAtCents: v.compareAtCents,
        isActive: v.isActive,
        availability: computeAvailability(v),
      })),
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
    const { category, status, q, page = "1", pageSize = "24", sort, deals, fields } = req.query;
    const minimal = fields === "minimal";

    const where = {
      ...(status ? { status } : { status: "ACTIVE" }),
      AND: [
        // Filtering server-side (rather than fetching a page of products and
        // checking isDeal client-side, as the storefront's /deals page used
        // to) matters because pageSize is capped at 100 — with more products
        // than that, a deal-flagged product past the first page was silently
        // invisible on the Deals page even though isDeal was true. The Deals
        // page shows only products staff have explicitly ticked — having a
        // markdown/compareAtCents price does not by itself qualify a product,
        // so staff retain full manual control over what appears there.
        ...(deals === "true" ? [{ isDeal: true }] : []),
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
    // Defaults to newest-first (unchanged behavior for existing callers, e.g.
    // the homepage's curated "Featured Furniture" row). Pass ?sort=oldest for
    // first-added-first ordering — used by the storefront's full listing
    // pages (/shop, /shop/[category], /deals, /wishlist, search).
    const orderBy = { createdAt: sort === "oldest" ? "asc" : "desc" };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: minimal ? PRODUCT_INCLUDE_MINIMAL : PRODUCT_INCLUDE,
        orderBy,
        take,
        skip,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products: products.map(minimal ? serializeProductMinimal : serializeProduct),
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
    const { variants, images, categoryIds, linkedProductIds, initialStock, ...productData } = req.body;
    // Secondary categories are purely additive to the primary categoryId —
    // dedupe so the same category never appears as both, which would violate
    // the ProductCategory composite primary key.
    const secondaryCategoryIds = (categoryIds ?? []).filter((id) => id !== productData.categoryId);
    // No self-link filter needed here (unlike PATCH below): this product's id
    // doesn't exist yet until tx.product.create() below runs, so the admin
    // form's search results — populated from already-existing products —
    // can never have offered this not-yet-created product as a candidate.
    const dedupedLinkIds = [...new Set(linkedProductIds ?? [])];

    // Product creation and its variants' StockBalance rows must commit
    // together: without a StockBalance row a variant is invisible on the
    // Inventory page and has no row for staff to adjust stock against, even
    // though the product looks normal (and sellable-looking, showing
    // "Available: 0") everywhere else. Two separate calls here previously let
    // a transient failure between them commit the product but silently skip
    // the stock rows — see docs/workflows/order-lifecycle.md.
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
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
      // page at all. This creates the row at onHand: 0 only; it is not a
      // stock receipt (no StockMovement is written), so a brand-new product
      // correctly stays "out of stock" until someone actually receives it.
      const locations = await tx.location.findMany({ where: { isActive: true }, select: { id: true } });
      if (locations.length > 0) {
        await tx.stockBalance.createMany({
          data: created.variants.flatMap((v) => locations.map((loc) => ({ variantId: v.id, locationId: loc.id }))),
          skipDuplicates: true,
        });
      }

      // Each selected product gets BOTH directions written in the same
      // transaction — (new product -> it) and (it -> new product) — so the
      // link is never visible from only one side, even momentarily.
      if (dedupedLinkIds.length > 0) {
        await tx.productLink.createMany({
          data: dedupedLinkIds.flatMap((linkedProductId) => [
            { productId: created.id, linkedProductId },
            { productId: linkedProductId, linkedProductId: created.id },
          ]),
          skipDuplicates: true,
        });
      }

      return created;
    });

    // Optional initial on-hand counts entered on the New Product form's
    // Inventory section, keyed by Location.id. Applied as real stock
    // receipts via the same adjustStock() the Inventory page's "Adjust"
    // action uses — each writes a StockMovement + AuditLog row, same as any
    // other stock mutation, rather than silently setting onHand. Runs after
    // (not inside) the product-creation transaction since adjustStock has
    // its own transaction and locking; the StockBalance rows it needs
    // already exist at onHand: 0 from the step above.
    const stockEntries = Object.entries(initialStock ?? {}).filter(([, qty]) => qty > 0);
    if (stockEntries.length > 0) {
      const variantId = product.variants[0].id;
      for (const [locationId, quantity] of stockEntries) {
        await inventoryService.adjustStock({
          variantId,
          locationId,
          type: "ADJUSTMENT_INCREASE",
          quantity,
          reasonCode: "initial_stock",
          performedById: req.user.id,
        });
      }
    }

    // Refetch if either post-transaction step ran: stock receipts update
    // availability, and linked-product rows were written after `created` (and
    // its PRODUCT_INCLUDE snapshot) were already fetched inside the
    // transaction, so `product.linkedProducts` would otherwise still read
    // empty on the response to this very request.
    const finalProduct = stockEntries.length > 0 || dedupedLinkIds.length > 0
      ? await prisma.product.findUniqueOrThrow({ where: { id: product.id }, include: PRODUCT_INCLUDE })
      : product;

    res.status(201).json({ product: serializeProduct(finalProduct) });
  })
);

router.patch(
  "/products/:id",
  requireAuth,
  requirePermission("catalog:write"),
  validateBody(productUpdateSchema),
  asyncHandler(async (req, res) => {
    const { variants, images, categoryIds, linkedProductIds, ...productData } = req.body;

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

    if (linkedProductIds) {
      // Full replace, like categoryIds above — but unlike categories, each
      // link also has a mirrored row on the OTHER product (productId swapped)
      // that this product's own submitted list knows nothing about. A plain
      // "delete all my rows, recreate from the list" would correctly add new
      // links both ways but would leave a stale reverse row on any product
      // that just got REMOVED from this list, still pointing back at this one
      // — so the removed side has to be diffed out and deleted explicitly on
      // both sides, not just dropped from this product's own outgoing rows.
      const dedupedLinkIds = [...new Set(linkedProductIds)].filter((id) => id !== req.params.id);
      const existingLinks = await prisma.productLink.findMany({
        where: { productId: req.params.id },
        select: { linkedProductId: true },
      });
      const existingLinkIds = existingLinks.map((l) => l.linkedProductId);
      const removedLinkIds = existingLinkIds.filter((id) => !dedupedLinkIds.includes(id));
      const addedLinkIds = dedupedLinkIds.filter((id) => !existingLinkIds.includes(id));

      if (removedLinkIds.length > 0) {
        await prisma.productLink.deleteMany({
          where: {
            OR: [
              { productId: req.params.id, linkedProductId: { in: removedLinkIds } },
              { productId: { in: removedLinkIds }, linkedProductId: req.params.id },
            ],
          },
        });
      }
      if (addedLinkIds.length > 0) {
        await prisma.productLink.createMany({
          data: addedLinkIds.flatMap((linkedProductId) => [
            { productId: req.params.id, linkedProductId },
            { productId: linkedProductId, linkedProductId: req.params.id },
          ]),
          skipDuplicates: true,
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
    const { q } = req.query;
    // ?q is additive — omitting it keeps this endpoint's existing behavior
    // (the full catalog, unfiltered) exactly as before, since the edit page
    // already depends on that to find one product client-side by id. Used by
    // the Linked Products picker (apps/admin/components/products/
    // LinkedProductPicker.jsx) to search by name OR any variant's SKU without
    // fetching the whole catalog — matches "add SKU" in the picker's search box.
    const where = q
      ? {
          OR: [
            { name: { contains: String(q), mode: "insensitive" } },
            { variants: { some: { sku: { contains: String(q), mode: "insensitive" } } } },
          ],
        }
      : undefined;
    const products = await prisma.product.findMany({
      where,
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: "desc" },
      // Only caps the search path — the unfiltered (no ?q) call the edit page
      // relies on to load the full catalog is untouched.
      take: q ? 20 : undefined,
    });
    res.json({ products: products.map(serializeProduct) });
  })
);

module.exports = router;
module.exports.pickDisplayCategory = pickDisplayCategory;
