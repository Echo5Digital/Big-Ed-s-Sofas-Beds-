const { z } = require("zod");

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

const categoryCreateSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(140).regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, hyphens only"),
  image: z.string().url().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

const variantCreateSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(160),
  color: z.string().max(80).optional().nullable(),
  size: z.string().max(80).optional().nullable(),
  widthInches: z.number().positive().optional().nullable(),
  heightInches: z.number().positive().optional().nullable(),
  depthInches: z.number().positive().optional().nullable(),
  weightLbs: z.number().positive().optional().nullable(),
  priceCents: z.number().int().nonnegative(),
  compareAtCents: z.number().int().nonnegative().optional().nullable(),
  costCents: z.number().int().nonnegative().optional().nullable(),
});

const productImageInputSchema = z.object({
  url: z.string().url(),
  altText: z.string().max(200).optional().nullable(),
});

const productCreateSchema = z.object({
  // Supports a lightweight inline markdown subset (**bold**, _italic_) —
  // rendered safely by packages/ui's parseInlineMarkdown, never as raw HTML.
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(220).regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, hyphens only"),
  description: z.string().max(4000).optional().nullable(),
  // Primary category (drives the admin list column + canonical breadcrumb).
  categoryId: z.string().uuid().optional().nullable(),
  // Additional categories this product should also appear under — see the
  // ProductCategory join table. Deduplicated against categoryId server-side.
  categoryIds: z.array(z.string().uuid()).optional(),
  brand: z.string().max(120).optional().nullable(),
  // Product-level display attributes, each hidden from the live storefront
  // page when unset. Distinct from Variant.color/size (which vary per SKU).
  itemName: z.string().max(160).optional().nullable(),
  color: z.string().max(80).optional().nullable(),
  material: z.string().max(120).optional().nullable(),
  dimensions: z.string().max(160).optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  variants: z.array(variantCreateSchema).min(1),
  images: z.array(productImageInputSchema).optional(),
});

const productUpdateSchema = productCreateSchema.partial().extend({
  variants: z.array(variantCreateSchema).optional(),
});

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

const stockAdjustSchema = z.object({
  variantId: z.string().uuid(),
  locationId: z.string().uuid(),
  type: z.enum(["ADJUSTMENT_INCREASE", "ADJUSTMENT_DECREASE"]),
  quantity: z.number().int().positive(),
  reasonCode: z.string().min(1).max(120),
});

const stockTransferSchema = z.object({
  variantId: z.string().uuid(),
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  quantity: z.number().int().positive(),
  notes: z.string().max(500).optional().nullable(),
});

const countCreateSchema = z.object({
  locationId: z.string().uuid(),
  notes: z.string().max(500).optional().nullable(),
  lines: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        expectedQty: z.number().int().nonnegative(),
      })
    )
    .min(1),
});

const countSubmitSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().uuid(),
        countedQty: z.number().int().nonnegative(),
      })
    )
    .min(1),
});

// ---------------------------------------------------------------------------
// Purchasing
// ---------------------------------------------------------------------------

const supplierCreateSchema = z.object({
  name: z.string().min(1).max(200),
  contactName: z.string().max(160).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  leadTimeDays: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const purchaseOrderCreateSchema = z.object({
  supplierId: z.string().uuid(),
  locationId: z.string().uuid(),
  expectedDate: z.string().datetime().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  lines: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        expectedQty: z.number().int().positive(),
        unitCostCents: z.number().int().nonnegative(),
        taxCents: z.number().int().nonnegative().optional(),
        freightCents: z.number().int().nonnegative().optional(),
      })
    )
    .min(1),
});

const purchaseOrderApproveSchema = z.object({
  approve: z.boolean(),
});

const goodsReceiptCreateSchema = z.object({
  locationId: z.string().uuid(),
  notes: z.string().max(1000).optional().nullable(),
  lines: z
    .array(
      z.object({
        poLineId: z.string().uuid(),
        acceptedQty: z.number().int().nonnegative(),
        damagedQty: z.number().int().nonnegative().optional(),
        differenceNotes: z.string().max(500).optional().nullable(),
      })
    )
    .min(1),
});

// ---------------------------------------------------------------------------
// Orders (e-commerce)
// ---------------------------------------------------------------------------

const cartLineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

const checkoutCreateSchema = z.object({
  lines: z.array(cartLineSchema).min(1),
  fulfillmentMethod: z.enum(["PICKUP", "DELIVERY"]),
  customer: z.object({
    email: z.string().email(),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: z.string().max(40).optional().nullable(),
  }),
  deliveryAddress: z
    .object({
      line1: z.string().min(1).max(200),
      line2: z.string().max(200).optional().nullable(),
      city: z.string().min(1).max(120),
      state: z.string().min(1).max(60),
      postalCode: z.string().min(1).max(20),
      country: z.string().min(1).max(60).optional(),
    })
    .optional()
    .nullable(),
});

// ---------------------------------------------------------------------------
// POS (in-store cashier app)
// ---------------------------------------------------------------------------

const registerOpenSchema = z.object({
  registerId: z.string().uuid(),
  openingCashCents: z.number().int().nonnegative(),
});

const registerCloseSchema = z.object({
  closingCashCents: z.number().int().nonnegative(),
  notes: z.string().max(1000).optional().nullable(),
});

// Card tender is intentionally not a distinct success path yet — no payment
// processor/terminal model has been selected (see
// docs/requirements/open-questions.md). CASH and DEPOSIT are real, working
// tenders; a request with method "CARD" is rejected at the route level with
// a 501 rather than silently faked.
const posSaleSchema = z
  .object({
    registerSessionId: z.string().uuid(),
    lines: z.array(cartLineSchema).min(1),
    tenderMethod: z.enum(["CASH", "CARD", "DEPOSIT"]),
    tenderedCents: z.number().int().nonnegative(),
    depositAmountCents: z.number().int().positive().optional(),
    discountCents: z.number().int().nonnegative().optional(),
    discountReasonCode: z.string().min(1).max(120).optional(),
    customer: z
      .object({
        email: z.string().email(),
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        phone: z.string().max(40).optional().nullable(),
      })
      .optional()
      .nullable(),
  })
  .refine((data) => !data.discountCents || Boolean(data.discountReasonCode), {
    message: "discountReasonCode is required whenever discountCents is greater than zero",
    path: ["discountReasonCode"],
  });

const posRefundSchema = z.object({
  registerSessionId: z.string().uuid(),
  orderId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  reasonCode: z.string().min(1).max(120),
  notes: z.string().max(1000).optional().nullable(),
  restock: z.boolean().optional(),
});

module.exports = {
  loginSchema,
  categoryCreateSchema,
  variantCreateSchema,
  productImageInputSchema,
  productCreateSchema,
  productUpdateSchema,
  stockAdjustSchema,
  stockTransferSchema,
  countCreateSchema,
  countSubmitSchema,
  supplierCreateSchema,
  purchaseOrderCreateSchema,
  purchaseOrderApproveSchema,
  goodsReceiptCreateSchema,
  cartLineSchema,
  checkoutCreateSchema,
  registerOpenSchema,
  registerCloseSchema,
  posSaleSchema,
  posRefundSchema,
};
