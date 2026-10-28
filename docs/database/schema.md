# Database Schema

Source of truth: `packages/database/prisma/schema.prisma`. This document is a
narrative guide to that file, not a copy of it — read the schema directly for
exact field types/constraints.

## Conventions applied throughout

- **IDs**: UUID (`@default(uuid())`) on every model.
- **Money**: always integer cents (`priceCents`, `totalCents`, etc.), never
  floating point, per the kickoff plan's explicit rule.
- **Uniqueness**: `Variant.sku`, `Product.slug`, `Category.slug`,
  `Order.orderNumber`, `PurchaseOrder.poNumber`, `Payment.providerEventId`,
  `ProviderEvent.eventId` are all unique-constrained at the database level —
  not just validated in application code.
- **Historical snapshots**: `OrderLine` stores `skuSnapshot`, `nameSnapshot`,
  `unitPriceCents` at time of sale, independent of the current `Variant`
  record. `POLine` stores `skuSnapshot` similarly. Prices are never
  recomputed retroactively from the live catalog.
- **Immutable ledger**: `StockMovement` rows are never updated or deleted by
  any API route — verify this by grepping `apps/api/src/services` for
  `stockMovement.update` or `.delete` (there are none; only `.create`).

## Domain groups

### Auth (`User`, `Role`, `Permission`, `RolePermission`, `UserRole`, `AuditLog`)

Many-to-many `User` ↔ `Role` ↔ `Permission` via join tables. Permission keys
in use (seeded in `packages/database/prisma/seed.js`):

`catalog:read`, `catalog:write`, `inventory:read`, `inventory:adjust`,
`purchasing:read`, `purchasing:write`, `purchasing:approve`,
`purchasing:receive`, `orders:read`, `orders:write`, `users:manage`,
`reports:read`, `pos:register:open`, `pos:register:close`, `pos:sell`,
`pos:refund`.

`AuditLog` records privileged actions (`inventory.adjust`,
`inventory.transfer`, `po.approve`, `po.reject`, `auth.login`) with the
acting user, entity, optional reason code, and a JSON metadata blob — append
only, never edited.

### Products (`Category`, `Product`, `Variant`, `ProductImage`, `PriceHistory`)

`Product` is the sellable concept (e.g. "Cloud Comfort Sectional");
`Variant` is the actual SKU-bearing, priced, stocked unit (e.g. "Gray" /
"Charcoal"). All stock, pricing, and order-line relationships point at
`Variant`, never `Product`, because a product without a variant can't be
sold or counted. `PriceHistory` is write-only — a new row per price change,
never a diff of the current row.

### Stock (`Location`, `StockBalance`, `StockMovement`, `Reservation`, `Transfer`, `Count`, `CountLine`)

- `Location.type` is `SHOWROOM` or `WAREHOUSE` — matches the plan's "showroom
  and warehouse modeled as separate stock locations."
- `StockBalance` is a **materialized cache** keyed on `(variantId,
  locationId)` — `onHand`, `reserved`, `quarantined`. It is always updated
  inside the same transaction as the `StockMovement` row that justifies the
  change, so it can never drift from the ledger under normal operation.
- Available-to-sell is computed, never stored: `onHand - reserved -
  quarantined`.
- `Reservation.expiresAt` + `status` (`ACTIVE`/`CONVERTED`/`EXPIRED`/
  `RELEASED`) implements the hold used by online checkout (and, later, POS
  deposits).
- `Count`/`CountLine` back cycle counts; submitting a count writes
  `ADJUSTMENT_INCREASE`/`ADJUSTMENT_DECREASE` movements for any discrepancy,
  same as a manual adjustment.

### Sales (`Customer`, `CustomerRegistration`, `Address`, `Order`, `OrderLine`, `Payment`, `Refund`, `ProviderEvent`)

`Customer` rows are created two ways: implicitly as a guest by checkout/POS
(`upsert` by email — `passwordHash` and `emailVerifiedAt` stay null), or by
a storefront sign-up that has confirmed its emailed one-time code (both set).
Only a customer with both set can sign in; see
`docs/architecture/overview.md#customer-accounts-storefront`.
`CustomerRegistration` holds a sign-up that is still waiting on its code —
the pending name/email/password hash plus a keyed hash of the code, expiry,
and attempt/resend counters. It is deliberately *not* a `Customer`: nothing
is written to `Customer` until the code is confirmed, and a row is deleted
when it completes, is replaced by a newer sign-up for the same email, or is
locked out. Abandoned rows are swept (after 24h) by the next sign-up.

`Order` has three independent status enums — see
`docs/architecture/overview.md#orders-three-independent-dimensions`.
`Payment.providerEventId` and `ProviderEvent.eventId` are both
unique-constrained specifically to make webhook/provider-event handling
idempotent once a real payment provider is integrated — duplicate webhook
deliveries become no-ops at the database constraint level, not just
application logic.

### POS (`Register`, `RegisterSession`, `CashMovement`, `Receipt`)

Implemented — see `apps/api/src/services/pos.service.js` and
`apps/pos/README.md`. `Register.locationId`, `RegisterSession.openedById`,
and `Receipt.orderId` are real foreign keys (to `Location`, `User`, and
`Order` respectively), added alongside the POS API build; they were bare,
unconstrained strings in the original schema-reservation pass.
`RegisterSession` tracks `openingCashCents`/`closingCashCents`/
`expectedCashCents`/`discrepancyCents` so closeout reconciliation is a
stored fact, not a report computed after the fact. `Order.channel` (`ONLINE`
| `POS`) and `Order.fulfillmentMethod` (`PICKUP` | `DELIVERY` | `IN_STORE`)
distinguish a POS walk-out sale from an online pickup/delivery order without
a separate order type.

### Purchasing (`Supplier`, `PurchaseOrder`, `POLine`, `GoodsReceipt`, `ReceiptLine`)

`PurchaseOrder.status` state machine: `DRAFT` → `AWAITING_APPROVAL` →
`SENT_TO_VENDOR` → `PARTIALLY_RECEIVED` → `RECEIVED` (or `CANCELED` at any
point before `RECEIVED`). Approval is a distinct manager-only step
(`purchasing:approve` permission) — a PO can never move past
`AWAITING_APPROVAL` without it, matching the plan's "manager must approve
before emailing vendor" rule. `POLine.receivedQty` accumulates across
multiple `GoodsReceipt` records to support partial/repeated deliveries
without over-receiving (enforced in `apps/api/src/routes/purchasing.routes.js`).

### Delivery (`Delivery`, `Pickup`, `StatusHistory`)

Reserved for the fulfillment console described on page 9 of the kickoff
plan. `StatusHistory` is a generic append-only log of status transitions per
order field (`status`/`paymentStatus`/`fulfillmentStatus`) — not yet written
to by any route, reserved for when the admin UI needs a visible audit trail
per order.

## Running migrations locally

```bash
cd packages/database
cp .env.example .env   # then edit DATABASE_URL to point at your Postgres instance
pnpm migrate            # prisma migrate dev — creates the first migration
pnpm seed                # seeds roles, permissions, an admin user, demo catalog
```

The seed script prints the generated admin password to the console —
**change it immediately** in any environment beyond a local sandbox; it is
also overridable via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars.
