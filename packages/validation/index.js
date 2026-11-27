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
// packages/database today — these five values change rarely and are already
// duplicated as plain strings elsewhere (seed.js, admin app/users/page.jsx).
// NOTE: this list drifted out of sync with Prisma once already (missing
// SUPER_ADMIN after it was added in migration 20261117035239) — if Prisma's
// RoleName enum changes, update this list in the same commit.
const roleNameSchema = z.enum(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALESMAN", "CASHIER"]);

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

// POS discount-override PIN (separate credential from the login password) —
// set/reset by an admin from the Users page. 4-6 digits, no confirmation
// field (same low-stakes-reset simplicity as the "Initial password" field on
// user creation — an admin can just reset again if mistyped).
const userPinUpdateSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
});

// Login password reset for a staff user — set by an admin from the Users
// page. No "current password" check (the admin isn't the account owner,
// unlike customerChangePasswordSchema's self-service flow) and no confirm
// field, same reasoning as userPinUpdateSchema above.
const userPasswordUpdateSchema = z.object({
  password: z.string().min(8).max(200),
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

// `type` is deliberately absent: customerAccount.service.js's createAddress
// always hardcodes it to SHIPPING for this self-service flow (BILLING is
// staff-side only), same reasoning as email's absence from
// customerProfileUpdateSchema above.
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

// "Original Price" (compareAtCents) is shown struck through on the storefront
// next to the (lower) Sale Price (priceCents) — must never be below
// priceCents, or the discount display would be nonsensical/misleading.
// Kept as a plain .refine() applied separately to the create/update object
// shapes below, since z.object(...).refine(...) returns a ZodEffects, which
// has no .extend() — variantUpdateSchema needs to add its own `id` field
// onto the plain object shape first, then apply the same refinement.
const comparePriceAboveSale = (data) => !data.compareAtCents || data.compareAtCents >= data.priceCents;
const comparePriceRefinement = {
  message: "Original Price must be greater than or equal to the Sale Price",
  path: ["compareAtCents"],
};

const variantFields = {
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
  // Percentage, e.g. 8.25 for 8.25% — defaults to 8.25 (DB column default)
  // when omitted, editable per product from the admin form's Inventory tab.
  taxRatePercent: z.number().nonnegative().max(100).optional(),
};

const variantCreateSchema = z.object(variantFields).refine(comparePriceAboveSale, comparePriceRefinement);

const productImageInputSchema = z.object({
  url: z.string().url(),
  // Present for images uploaded through the admin's Cloudinary upload
  // endpoint; absent for images added by pasting an external URL directly.
  publicId: z.string().max(300).optional().nullable(),
  altText: z.string().max(200).optional().nullable(),
});

// Mirrors productImageInputSchema exactly (same url/publicId shape, same
// reasoning for publicId being optional/nullable) — see ProductVideo in
// schema.prisma for why this is a separate schema rather than reusing the
// image one.
const productVideoInputSchema = z.object({
  url: z.string().url(),
  publicId: z.string().max(300).optional().nullable(),
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
  // `brand` and `supplierId` are internal-only (staff-facing) — never returned
  // by the public storefront routes, see serializeProduct's `includeInternal`.
  brand: z.string().trim().max(120).optional().nullable(),
  // Existing Supplier.id this product is bought from; the route verifies it
  // exists (a bare FK violation would otherwise surface as a 500).
  supplierId: z.string().uuid().optional().nullable(),
  // Product-level display attributes, each hidden from the live storefront
  // page when unset. Distinct from Variant.color/size (which vary per SKU).
  itemName: z.string().max(160).optional().nullable(),
  color: z.string().max(80).optional().nullable(),
  material: z.string().max(120).optional().nullable(),
  dimensions: z.string().max(160).optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  // Staff-controlled flag for inclusion on the storefront Deals page.
  isDeal: z.boolean().optional(),
  // Warranty tab: when ticked the storefront product page shows "Warrantied"
  // plus `warrantyNote` as "Warranty Details". Unlike brand/supplierId these
  // are public. The routes clear warrantyNote whenever isWarrantied is false.
  isWarrantied: z.boolean().optional(),
  warrantyNote: z.string().trim().max(2000).optional().nullable(),
  variants: z.array(variantCreateSchema).min(1),
  images: z.array(productImageInputSchema).optional(),
  videos: z.array(productVideoInputSchema).optional(),
  // Other, independently-sellable Products to cross-link (see ProductLink in
  // schema.prisma) — distinct from `variants` above, which are color/size
  // options of THIS product sharing one page. Full-replace semantics on
  // update, same as categoryIds; written/removed as a symmetric pair in both
  // directions by the route handler, never just this one direction.
  linkedProductIds: z.array(z.string().uuid()).optional(),
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
const variantUpdateSchema = z
  .object({ ...variantFields, id: z.string().uuid().optional() })
  .refine(comparePriceAboveSale, comparePriceRefinement);

const productUpdateSchema = productCreateSchema.partial().extend({
  variants: z.array(variantUpdateSchema).optional(),
});

// Guest product review submission (storefront) — mirrors how a guest
// Customer row is created from just a name/email at checkout, not a signed-in
// account. 1-3 star reviews are held as PENDING for staff moderation; 4-5
// star reviews publish immediately (see POST /products/:slug/reviews).
const reviewCreateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(1).max(2000),
  authorName: z.string().trim().min(1).max(120),
  authorEmail: z.string().trim().email().max(200),
});

// Storefront /contact page — public, unauthenticated submission.
const contactMessageCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(1).max(5000),
});

// Storefront /contact page's "Request Return" mode — public, unauthenticated
// submission via multipart/form-data (POST /messages/return), so these are
// the text fields only; the optional attachment file is validated/streamed
// to Cloudinary by the route itself (same pattern as catalog image uploads),
// not by this schema. returnOrderReference is optional at this layer because
// a customer may instead attach a file with no typed reference — the route
// rejects the request only if *neither* is present.
const returnMessageCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(1).max(5000),
  returnOrderReference: z.string().trim().max(200).optional(),
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

// PATCH /purchasing/suppliers/:id — any subset of the create fields, plus
// isActive (the Activate / Deactivate button on the admin Suppliers page).
// Keep in sync with the Supplier model in schema.prisma.
const supplierUpdateSchema = supplierCreateSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

const purchaseOrderCreateSchema = z.object({
  supplierId: z.string().uuid(),
  locationId: z.string().uuid(),
  notes: z.string().max(1000).optional().nullable(),
  lines: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        expectedQty: z.number().int().positive(),
        unitCostCents: z.number().int().nonnegative(),
        taxCents: z.number().int().nonnegative().optional(),
        freightCents: z.number().int().nonnegative().optional(),
        // Per-line delivery expectation — a PO spanning multiple SKUs can
        // have a different expected date per item rather than one date
        // forced across the whole order.
        expectedDate: z.string().datetime().optional().nullable(),
      })
    )
    .min(1),
});

const purchaseOrderApproveSchema = z.object({
  approve: z.boolean(),
});

// Only a DRAFT PO can be edited (enforced in the route, not here) — once it
// moves to AWAITING_APPROVAL a line's qty/cost is part of what's being
// approved, so editing it afterward would need a new approval cycle, not a
// silent in-place update.
const purchaseOrderUpdateSchema = z.object({
  locationId: z.string().uuid().optional(),
  notes: z.string().max(1000).optional().nullable(),
  lines: z
    .array(
      z.object({
        id: z.string().uuid(),
        expectedQty: z.number().int().positive(),
        unitCostCents: z.number().int().nonnegative(),
        taxCents: z.number().int().nonnegative().optional(),
        freightCents: z.number().int().nonnegative().optional(),
        expectedDate: z.string().datetime().optional().nullable(),
      })
    )
    .min(1)
    .optional(),
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
        // Current "balance owed" note for this line, set when the receipt
        // leaves it short (receivedQty < expectedQty). Omit/blank to leave
        // any prior note on the line untouched for this receipt round.
        pendingNote: z.string().max(500).optional().nullable(),
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

// POST /checkout/:id/pay — the Square Web Payments SDK's card.tokenize()
// result's `token` field, submitted once the order itself already exists
// (see POST /checkout above). sourceId is Square's name for this value
// (a single-use token, or "cnon:..." for a card nonce) in CreatePayment.
// verificationToken is the result of the SDK's separate verifyBuyer() call
// (3D Secure / SCA buyer authentication) — optional because verifyBuyer()
// only forces an interactive challenge when the card issuer actually
// requires one; CreatePayment itself treats verification_token as optional
// for the same reason.
const checkoutPaySchema = z.object({
  sourceId: z.string().min(1).max(255),
  verificationToken: z.string().min(1).max(255).optional(),
});

// Mirrors the unified display-status ladder computeOrderDisplayStatus()
// derives from Order.status/paymentStatus/fulfillmentStatus (see
// apps/api/src/services/orderStatus.service.js) — NOT a Prisma enum itself
// (there is no such column), so kept here as a plain literal list. "Draft"
// and "Canceled" are intentionally excluded: Draft is a read of payment
// state (reversing it is settleBalance/refund's job, not this endpoint's),
// and canceling an order is a separate, higher-stakes action than a plain
// status change.
const orderDisplayStatusSchema = z.enum(["Ordered", "Processing", "Ready", "Completed"]);

const orderStatusUpdateSchema = z.object({
  displayStatus: orderDisplayStatusSchema,
  note: z.string().max(1000).optional().nullable(),
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
// docs/requirements/open-questions.md). CASH, DEPOSIT, BANK_TRANSFER, and
// STORE_CREDIT are real, working tenders that can be split across multiple
// entries in one sale; a request containing a "CARD" entry is rejected at
// the route level with a 501 rather than silently faked.
const posPaymentEntrySchema = z.object({
  method: z.enum(["CASH", "CARD", "DEPOSIT", "BANK_TRANSFER", "STORE_CREDIT"]),
  amountCents: z.number().int().positive(),
  reference: z.string().max(120).optional().nullable(),
});

// A discount is entered as EITHER a percent of subtotal OR a flat cents
// amount — never both — so the server always knows which mode the cashier
// chose and can recompute discountCents fresh from it (never trusting a
// client-sent cents figure for percent mode). See pos.service.js's ringSale.
const discountInputSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("PERCENT"), percent: z.number().int().min(1).max(100) }),
  z.object({ mode: z.literal("FLAT_CENTS"), amountCents: z.number().int().positive() }),
]);

// Shape-only validation for a manager/admin's POS PIN entered on the
// cashier's screen to authorize a discount above the unsupervised ceiling.
// Whether a PIN is actually *required* depends on the resolved discount
// percent vs. the subtotal — a business rule resolved in ringSale, not here.
const pinOverrideSchema = z.object({
  approverPin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
});

// Credits 1-2 staff members for a sale. When two are given their percents
// must sum to 100 (enforced below); a single entry is expected to be 100.
const salesAttributionEntrySchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["SALESMAN", "MANAGER"]),
  percent: z.number().int().min(1).max(100),
});

const posAddressInputSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(60),
  postalCode: z.string().trim().min(1).max(20),
  country: z.string().trim().min(1).max(60).optional(),
});

const posSaleSchema = z
  .object({
    registerSessionId: z.string().uuid(),
    lines: z.array(cartLineSchema).min(1),
    payments: z.array(posPaymentEntrySchema).min(1),
    discount: discountInputSchema.optional(),
    discountReasonCode: z.string().min(1).max(120).optional(),
    pinOverride: pinOverrideSchema.optional(),
    salesAttribution: z.array(salesAttributionEntrySchema).min(1).max(2).optional(),
    requestedDeliveryAt: z.coerce.date().optional().nullable(),
    shippingAddress: posAddressInputSchema.optional().nullable(),
    billingAddress: posAddressInputSchema.optional().nullable(),
    billingSameAsShipping: z.boolean().optional(),
    // Attach an existing customer found via search — mutually exclusive with
    // `customer` below (service prefers customerId when both are present).
    customerId: z.string().uuid().optional(),
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
  .refine((data) => !data.discount || Boolean(data.discountReasonCode), {
    message: "discountReasonCode is required whenever a discount is applied",
    path: ["discountReasonCode"],
  })
  .refine(
    (data) =>
      !data.salesAttribution ||
      data.salesAttribution.length !== 2 ||
      data.salesAttribution[0].percent + data.salesAttribution[1].percent === 100,
    { message: "Split percentages must add up to 100", path: ["salesAttribution"] }
  )
  .refine(
    (data) => !data.salesAttribution || data.salesAttribution.length !== 1 || data.salesAttribution[0].percent === 100,
    { message: "A single attributed staff member must be credited 100%", path: ["salesAttribution"] }
  );

const posRefundSchema = z.object({
  registerSessionId: z.string().uuid(),
  orderId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  reasonCode: z.string().min(1).max(120),
  notes: z.string().max(1000).optional().nullable(),
  restock: z.boolean().optional(),
  paymentId: z.string().uuid().optional().nullable(),
});

// Collecting the rest of a deposit/under-tendered sale's balance — CARD is
// still a valid shape here (posSaleSchema allows it too) even though the
// service rejects it before processing, same "shape vs. business rule"
// split as posSaleSchema's own CARD handling.
const posSettleBalanceSchema = z.object({
  registerSessionId: z.string().uuid(),
  orderId: z.string().uuid(),
  payments: z.array(posPaymentEntrySchema).min(1),
});

// ---------------------------------------------------------------------------
// POS customer search / creation (checkout customer identification)
// ---------------------------------------------------------------------------

const posCustomerCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(1, "Phone number is required").max(40),
  email: z.string().trim().toLowerCase().email().max(254).optional().nullable(),
  address: z
    .object({
      line1: z.string().trim().min(1).max(200),
      line2: z.string().trim().max(200).optional().nullable(),
      city: z.string().trim().min(1).max(120),
      state: z.string().trim().min(1).max(60),
      postalCode: z.string().trim().min(1).max(20),
    })
    .optional()
    .nullable(),
});

// ---------------------------------------------------------------------------
// POS returns / exchanges
// ---------------------------------------------------------------------------

const returnLineInputSchema = z.object({
  orderLineId: z.string().uuid(),
  quantity: z.number().int().positive(),
  condition: z.enum(["SELLABLE", "DAMAGED", "QUARANTINED", "REQUIRES_INSPECTION"]),
  reasonCode: z.enum([
    "CUSTOMER_CHANGED_MIND",
    "DAMAGED_PRODUCT",
    "WRONG_PRODUCT",
    "DEFECTIVE_PRODUCT",
    "OTHER",
  ]),
  replacementVariantId: z.string().uuid().optional().nullable(),
});

const posReturnCreateSchema = z.object({
  orderId: z.string().uuid(),
  registerSessionId: z.string().uuid(),
  lines: z.array(returnLineInputSchema).min(1),
  refundMethod: z.enum(["CASH", "CARD", "DEPOSIT", "BANK_TRANSFER", "STORE_CREDIT"]).optional(),
  paymentId: z.string().uuid().optional().nullable(),
  exchangeReplacements: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().positive(),
      })
    )
    .optional(),
  balancePayments: z.array(posPaymentEntrySchema).optional(),
});

module.exports = {
  loginSchema,
  userCreateSchema,
  userUpdateSchema,
  userRolesUpdateSchema,
  userPinUpdateSchema,
  userPasswordUpdateSchema,
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
  productVideoInputSchema,
  productCreateSchema,
  productUpdateSchema,
  reviewCreateSchema,
  contactMessageCreateSchema,
  returnMessageCreateSchema,
  stockAdjustSchema,
  stockTransferSchema,
  countCreateSchema,
  countSubmitSchema,
  supplierCreateSchema,
  supplierUpdateSchema,
  purchaseOrderCreateSchema,
  purchaseOrderUpdateSchema,
  purchaseOrderApproveSchema,
  goodsReceiptCreateSchema,
  cartLineSchema,
  checkoutCreateSchema,
  checkoutPaySchema,
  orderDisplayStatusSchema,
  orderStatusUpdateSchema,
  registerOpenSchema,
  registerCloseSchema,
  registerReopenApproveSchema,
  registerReopenDenySchema,
  posPaymentEntrySchema,
  salesAttributionEntrySchema,
  pinOverrideSchema,
  posAddressInputSchema,
  posSaleSchema,
  posRefundSchema,
  posSettleBalanceSchema,
  posCustomerCreateSchema,
  posReturnCreateSchema,
};
