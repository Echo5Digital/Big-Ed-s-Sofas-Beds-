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

const productCreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(220).regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, hyphens only"),
  description: z.string().max(4000).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  brand: z.string().max(120).optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  variants: z.array(variantCreateSchema).min(1),
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

module.exports = {
  loginSchema,
  categoryCreateSchema,
  variantCreateSchema,
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
};
