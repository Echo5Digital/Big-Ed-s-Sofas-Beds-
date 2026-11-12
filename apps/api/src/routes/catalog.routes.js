const express = require("express");
const multer = require("multer");
const { prisma } = require("@big-eds/database");
const { productCreateSchema, productUpdateSchema, categoryCreateSchema } = require("@big-eds/validation");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { NotFoundError, ValidationError, ConflictError } = require("../lib/errors");
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

// Same memory-buffer-then-stream-to-Cloudinary approach as images, but a
// separate multer instance: a much larger size limit (product demo clips
// run tens of MB, nowhere near an 8MB image cap) and a video mimetype
// allowlist, so an oversized/wrong-type video can't slip through the image
// uploader's limits or vice versa.
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_VIDEO_TYPES.has(file.mimetype)) {
      return cb(new ValidationError({ file: "Only MP4, WebM, or MOV videos are allowed" }));
    }
    cb(null, true);
  },
});

// resource_type: "video" is required here — Cloudinary doesn't auto-detect
// video vs image from the buffer, and uploading a video through the image
// uploader's upload_stream (resource_type: "image") fails outright.
function uploadVideoBufferToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "products/videos", resource_type: "video" },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

// Links are maintained as a fully-connected group (clique), not just pairwise
// edges back to whichever product was being edited: if E submits
// linkedProductIds [A, B, C, D], then A, B, C, and D must all end up linked
// to each other too, not only back to E. Submitting a product that already
// belongs to ITS OWN existing group (e.g. A was already linked to X) merges
// that group in as well, so the end state is always one single clique
// containing every product transitively reachable from the edit — there is
// no modeled "group id", just the invariant that every product's `linkedTo`
// always equals its whole clique minus itself.
//
// Removal means leaving the group entirely (confirmed product behavior): if
// B is dropped from this submission, B is unlinked from EVERY other member of
// the group it was just in, not just from the product being edited — a
// partial edge removal would leave a clique that isn't actually a clique
// anymore.
//
// `tx` may be the plain `prisma` client or a `$transaction` callback's `tx` —
// both expose the same `productLink` delegate.
async function syncProductLinksAsGroup(tx, productId, submittedLinkIds) {
  const dedupedSubmittedIds = [...new Set(submittedLinkIds)].filter((id) => id !== productId);

  const existingLinks = await tx.productLink.findMany({
    where: { productId },
    select: { linkedProductId: true },
  });
  const oldGroup = new Set([productId, ...existingLinks.map((l) => l.linkedProductId)]);

  // Any existing member of this product's group that wasn't resubmitted is
  // being dropped from the group entirely. Computed up front, before merging
  // in submitted members' own existing links below — those links still
  // include stale edges to exactly these about-to-be-dropped members (they
  // haven't been deleted yet), so without this exclusion a dropped member
  // would get pulled straight back into newGroup via its old clique-mate's
  // `theirLinks` row.
  const droppedMembers = new Set([...oldGroup].filter((id) => id !== productId && !dedupedSubmittedIds.includes(id)));

  // Start the new group from this product plus whatever was just submitted,
  // then pull in each submitted product's OWN existing group (minus anyone
  // being dropped, per above) so two previously-separate cliques correctly
  // merge into one instead of the newly-added member staying only
  // half-linked.
  const newGroup = new Set([productId, ...dedupedSubmittedIds]);
  if (dedupedSubmittedIds.length > 0) {
    const theirLinks = await tx.productLink.findMany({
      where: { productId: { in: dedupedSubmittedIds } },
      select: { productId: true, linkedProductId: true },
    });
    for (const link of theirLinks) {
      if (!droppedMembers.has(link.productId)) newGroup.add(link.productId);
      if (!droppedMembers.has(link.linkedProductId)) newGroup.add(link.linkedProductId);
    }
  }

  const leavingMembers = [...oldGroup].filter((id) => !newGroup.has(id));

  // Anyone leaving the group is unlinked from every other member of the
  // group they were just part of (oldGroup ∪ newGroup, so this also covers
  // links to members only present in the merged-in group), not just from
  // `productId`.
  const allTouchedIds = new Set([...oldGroup, ...newGroup]);
  if (leavingMembers.length > 0) {
    await tx.productLink.deleteMany({
      where: {
        OR: [
          { productId: { in: leavingMembers }, linkedProductId: { in: [...allTouchedIds] } },
          { productId: { in: [...allTouchedIds] }, linkedProductId: { in: leavingMembers } },
        ],
      },
    });
  }

  // Close the remaining group into a full clique: every ordered pair within
  // it gets a ProductLink row. skipDuplicates makes this safe to run even
  // for pairs that are already linked.
  const finalGroup = [...newGroup];
  if (finalGroup.length > 1) {
    const pairs = [];
    for (const a of finalGroup) {
      for (const b of finalGroup) {
        if (a !== b) pairs.push({ productId: a, linkedProductId: b });
      }
    }
    await tx.productLink.createMany({ data: pairs, skipDuplicates: true });
  }
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
  videos: { orderBy: { sortOrder: "asc" } },
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
// ever reads variant sku/name/price/availability/thumbnail — it never shows
// full-size images, category, or description. Those extra relations are real
// Prisma-level round trips (category, categoryTags+category, every image)
// and real over-the-wire payload (full Cloudinary URLs/alt text for every
// image on every product) that POS fetches and immediately discards on every
// debounced keystroke. ?fields=minimal skips them, but still takes the
// single primary (lowest sortOrder) image per product so cart/search
// thumbnails have something to render — every other caller (storefront)
// is unaffected and keeps the full default shape.
const PRODUCT_INCLUDE_MINIMAL = {
  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
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
    imageUrl: product.images[0]?.url ?? null,
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

// `includeCost` must default to false and must only ever be passed `true` by
// an admin route that has already checked the caller holds
// "catalog:cost:view" (see GET /admin/products below) — this function is
// also called directly by the two public storefront routes (GET /products,
// GET /products/:slug) with no auth at all, so costCents must never be
// reachable through any code path that doesn't explicitly opt in per-request.
function serializeProduct(product, { includeCost = false } = {}) {
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
    videos: product.videos.map((v) => ({ id: v.id, url: v.url, publicId: v.publicId })),
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
      ...(includeCost ? { costCents: v.costCents } : null),
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
      // Passed as a wrapped arrow, not the bare function reference: Array.map
      // calls its callback with (element, index, array) — serializeProduct's
      // second parameter is a destructured options object, and passing the
      // bare function would hand it `index` (a number) as that second arg,
      // throwing on every request ("Cannot destructure property 'includeCost'
      // of ... as it is not an object").
      products: products.map((p) => (minimal ? serializeProductMinimal(p) : serializeProduct(p))),
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
  "/admin/videos",
  requireAuth,
  requirePermission("catalog:write"),
  uploadVideo.array("videos", 5),
  asyncHandler(async (req, res) => {
    const files = req.files || [];
    if (files.length === 0) {
      throw new ValidationError({ videos: "At least one video file is required" });
    }
    const uploaded = await Promise.all(files.map((file) => uploadVideoBufferToCloudinary(file.buffer)));
    const videos = uploaded.map((result) => ({
      url: result.secure_url,
      publicId: result.public_id,
    }));
    res.status(201).json({ videos });
  })
);

router.post(
  "/products",
  requireAuth,
  requirePermission("catalog:write"),
  validateBody(productCreateSchema),
  asyncHandler(async (req, res) => {
    const { variants, images, videos, categoryIds, linkedProductIds, initialStock, ...productData } = req.body;
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
          videos: videos ? { create: videos.map((v, i) => ({ ...v, sortOrder: i })) } : undefined,
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

      // Links the new product into a full clique with every selected product
      // (and whatever groups those products already belonged to) — see
      // syncProductLinksAsGroup. The new product can't have any existing
      // links of its own yet, so this only ever adds, never removes.
      if (dedupedLinkIds.length > 0) {
        await syncProductLinksAsGroup(tx, created.id, dedupedLinkIds);
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
    const { variants, images, videos, categoryIds, linkedProductIds, ...productData } = req.body;

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

    if (videos) {
      // Same full-replace semantics as images above.
      await prisma.productVideo.deleteMany({ where: { productId: req.params.id } });
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
      // Full replace, like categoryIds above — maintained as a fully-connected
      // group rather than plain pairwise edges, and any member dropped from
      // the submission leaves the whole group, not just its edge to this
      // product. See syncProductLinksAsGroup.
      await syncProductLinksAsGroup(prisma, req.params.id, linkedProductIds);
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...productData,
        images: images ? { create: images.map((img, i) => ({ ...img, sortOrder: i })) } : undefined,
        videos: videos ? { create: videos.map((v, i) => ({ ...v, sortOrder: i })) } : undefined,
      },
      include: PRODUCT_INCLUDE,
    });

    res.json({ product: serializeProduct(product) });
  })
);

// Archive/unarchive is the normal, always-available "delete" for staff: it
// flips Product.status to ARCHIVED, which GET /products (storefront) already
// excludes by default (see that route's status filter above) — the product
// disappears from the live site immediately, with every Variant, StockBalance,
// StockMovement, OrderLine, Reservation, Transfer, and POLine left completely
// intact, so order/inventory history is never at risk. This is deliberately a
// separate, dedicated action from PATCH /products/:id's general-purpose
// status field so it gets its own audit action name (product.archive /
// product.unarchive), matching users.routes.js's isActive activate/deactivate
// pattern — a raw status PATCH would work but wouldn't leave this audit trail.
router.patch(
  "/products/:id/archive",
  requireAuth,
  requirePermission("catalog:write"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) throw new NotFoundError("Product not found");

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { status: "ARCHIVED" },
      include: PRODUCT_INCLUDE,
    });

    await prisma.auditLog.create({
      data: { userId: req.user.id, action: "product.archive", entityType: "Product", entityId: product.id },
    });

    res.json({ product: serializeProduct(product) });
  })
);

router.patch(
  "/products/:id/unarchive",
  requireAuth,
  requirePermission("catalog:write"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) throw new NotFoundError("Product not found");

    // Lands back in DRAFT, not ACTIVE: restoring a product shouldn't make it
    // instantly live again without a staff member reviewing it first (price,
    // stock, photos may be stale after however long it sat archived) — the
    // same reasoning new products already go through via productCreateSchema's
    // default DRAFT status.
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { status: "DRAFT" },
      include: PRODUCT_INCLUDE,
    });

    await prisma.auditLog.create({
      data: { userId: req.user.id, action: "product.unarchive", entityType: "Product", entityId: product.id },
    });

    res.json({ product: serializeProduct(product) });
  })
);

// A real, permanent delete — offered ONLY when none of this product's
// variants have ever touched the immutable/history-bearing tables (an
// append-only ledger, a placed order, an active reservation, a stock
// transfer, or a purchase-order line). Those five relations are all
// onDelete: Restrict in schema.prisma specifically so a hard delete can never
// silently destroy sales/audit history — this route checks for exactly that
// history up front and refuses with a clear 409 instead of letting the
// Prisma call fail with an opaque foreign-key-violation error. A product with
// no such history has nothing worth preserving, so hard-deleting it (which
// cascades to its Variants, StockBalance, PriceHistory, ProductImage,
// ProductCategory, and ProductLink rows — all onDelete: Cascade) is safe.
// For every other product, archive (above) is the only option, by design.
// Counts every row across the five history-bearing, onDelete: Restrict
// tables for a given set of variant ids. Extracted from the DELETE route
// below so tests can exercise the exact same check the route relies on,
// rather than a separately-maintained copy that could drift out of sync.
async function getProductDeleteBlockers(variantIds) {
  const [stockMovementCount, orderLineCount, reservationCount, transferCount, poLineCount] = await Promise.all([
    prisma.stockMovement.count({ where: { variantId: { in: variantIds } } }),
    prisma.orderLine.count({ where: { variantId: { in: variantIds } } }),
    prisma.reservation.count({ where: { variantId: { in: variantIds } } }),
    prisma.transfer.count({ where: { variantId: { in: variantIds } } }),
    prisma.pOLine.count({ where: { variantId: { in: variantIds } } }),
  ]);
  return { stockMovementCount, orderLineCount, reservationCount, transferCount, poLineCount };
}

router.delete(
  "/products/:id",
  requireAuth,
  requirePermission("catalog:write"),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, variants: { select: { id: true } } },
    });
    if (!product) throw new NotFoundError("Product not found");

    const variantIds = product.variants.map((v) => v.id);
    const blockers = await getProductDeleteBlockers(variantIds);
    const historyCount = Object.values(blockers).reduce((sum, n) => sum + n, 0);

    if (historyCount > 0) {
      throw new ConflictError(
        "This product has stock, order, reservation, transfer, or purchase-order history and can't be permanently deleted — archive it instead.",
        blockers
      );
    }

    await prisma.product.delete({ where: { id: product.id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "product.delete",
        entityType: "Product",
        entityId: product.id,
        metadata: { name: product.name },
      },
    });

    res.json({ success: true });
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
    // Independent of "catalog:read" (required just to hit this route at all,
    // via requirePermission above) — a role can list/edit products without
    // seeing cost, so this is checked per-request rather than folded into
    // the route-level permission gate.
    const includeCost = req.user.permissions.has("catalog:cost:view");
    res.json({ products: products.map((p) => serializeProduct(p, { includeCost })) });
  })
);

// Purely additive: the Edit Product page (apps/admin/app/products/[id]/page.jsx)
// used to find "its" product by filtering the full GET /admin/products list
// client-side, because this endpoint didn't exist (see that file's prior
// comment). That meant loading every product + every variant + every image
// in the catalog just to edit one. This fetches exactly one.
router.get(
  "/admin/products/:id",
  requireAuth,
  requirePermission("catalog:read"),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundError("Product not found");

    const includeCost = req.user.permissions.has("catalog:cost:view");
    res.json({ product: serializeProduct(product, { includeCost }) });
  })
);

module.exports = router;
module.exports.pickDisplayCategory = pickDisplayCategory;
module.exports.syncProductLinksAsGroup = syncProductLinksAsGroup;
module.exports.getProductDeleteBlockers = getProductDeleteBlockers;
module.exports.serializeProduct = serializeProduct;
