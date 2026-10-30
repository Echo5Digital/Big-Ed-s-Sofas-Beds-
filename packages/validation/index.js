const { z } = require("zod");

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Mirrors the Prisma RoleName enum (packages/database/prisma/schema.prisma)
// exactly. Kept as a plain literal list rather than importing the generated
// Prisma client here, since packages/validation has no dependency on
// packages/database today — these four values change rarely and are already
// duplicated as plain strings elsewhere (seed.js, admin AppShell nav).
const roleNameSchema = z.enum(["ADMIN", "MANAGER", "STAFF", "CASHIER"]);

const userCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  roleNames: z.array(roleNameSchema).min(1, "Select at least one role"),
});

const userUpdateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

const userRolesUpdateSchema = z.object({
  roleNames: z.array(roleNameSchema).min(1, "Select at least one role"),
});

// ---------------------------------------------------------------------------
// Customer accounts (storefront sign-up / sign-in)
// ---------------------------------------------------------------------------

// Normalised at the edge so "Jane@X.com" and "jane@x.com" are one account.
const customerEmailSchema = z.string().trim().toLowerCase().email().max(254);

// bcrypt only hashes the first 72 *bytes* and silently ignores the rest, so
// cap on bytes (not characters) instead of letting a long passphrase appear to
// work while only its prefix is actually checked.
const customerPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((value) => new TextEncoder().encode(value).length <= 72, {
    message: "Password must be at most 72 bytes",
  });

const customerRegisterSchema = z.object({
  email: customerEmailSchema,
  password: customerPasswordSchema,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
});

const customerVerifyOtpSchema = z.object({
  pendingId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

const customerResendOtpSchema = z.object({
  pendingId: z.string().uuid(),
});

// Deliberately lenient on password length: sign-in should answer "wrong
// email or password", never reveal the password rules to a guesser.
const customerLoginSchema = z.object({
  email: customerEmailSchema,
  password: z.string().min(1).max(200),
});

// ---------------------------------------------------------------------------
// Customer account area (profile, password, saved addresses)
// ---------------------------------------------------------------------------

// Blank optional inputs arrive from forms as "" — store them as null instead.
const blankToNull = (value) => (value === "" ? null : value);

// Lenient on formatting ("(555) 123-4567", "+1 555 123 4567") but must look
// like a phone number: only phone punctuation and 7-15 digits.
const customerPhoneSchema = z
  .string()
  .trim()
  .max(40)
  .refine((value) => value === "" || (/^[+()\d\s.-]+$/.test(value) && /^\d{7,15}$/.test(value.replace(/\D/g, ""))), {
    message: "Enter a valid phone number",
  })
  .transform(blankToNull);

// Email is deliberately absent: it is the sign-in identity and is only ever
// set by the verified sign-up flow.
const customerProfileUpdateSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  phone: customerPhoneSchema.optional().nullable(),
});

const customerChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(200),
    newPassword: customerPasswordSchema,
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Choose a password you haven't used before",
    path: ["newPassword"],
  });

const customerAddressSchema = z.object({
  line1: z.string().trim().min(1, "Street address is required").max(200),
  line2: z.string().trim().max(200).transform(blankToNull).optional().nullable(),
  city: z.string().trim().min(1, "City is required").max(120),
  state: z.string().trim().min(1, "State is required").max(60),
  postalCode: z.string().trim().min(1, "ZIP / postal code is required").max(20),
  country: z.string().trim().min(1).max(60).optional(),
  isDefault: z.boolean().optional(),
});

const customerAddressUpdateSchema = customerAddressSchema.partial();

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
  // Present for images uploaded through the admin's Cloudinary upload
  // endpoint; absent for images added by pasting an external URL directly.
  publicId: z.string().max(300).optional().nullable(),
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
  // Staff-controlled flag for inclusion on the storefront Deals page.
  isDeal: z.boolean().optional(),
  variants: z.array(variantCreateSchema).min(1),
  images: z.array(productImageInputSchema).optional(),
  // Optional initial on-hand count per location, keyed by Location.id, e.g.
  // { "<showroomId>": 2, "<warehouseId>": 5 }. Applied via the same
  // inventoryService.adjustStock() used by the Inventory page's manual
  // "Adjust" action, so it writes a real StockMovement/AuditLog row rather
  // than silently setting StockBalance.onHand — this is a real stock receipt
  // at creation time, not a cosmetic display number.
  initialStock: z.record(z.string().uuid(), z.number().int().nonnegative()).optional(),
});

// Variant identity on update must travel by id, not sku — sku is the field
// being edited, so matching on its new value can never find the existing row.
const variantUpdateSchema = variantCreateSchema.extend({
  id: z.string().uuid().optional(),
});

const productUpdateSchema = productCreateSchema.partial().extend({
  variants: z.array(variantUpdateSchema).optional(),
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

const registerReopenApproveSchema = z.object({
  closingCashCents: z.number().int().nonnegative(),
  notes: z.string().max(1000).optional().nullable(),
});

const registerReopenDenySchema = z.object({
  reason: z.string().max(1000).optional().nullable(),
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
  userCreateSchema,
  userUpdateSchema,
  userRolesUpdateSchema,
  customerRegisterSchema,
  customerVerifyOtpSchema,
  customerResendOtpSchema,
  customerLoginSchema,
  customerProfileUpdateSchema,
  customerChangePasswordSchema,
  customerAddressSchema,
  customerAddressUpdateSchema,
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
  registerReopenApproveSchema,
  registerReopenDenySchema,
  posSaleSchema,
  posRefundSchema,
};
