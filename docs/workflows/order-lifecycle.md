# Business-Critical Workflows

These are the state machines the kickoff plan identifies as sources of
business-data corruption if implemented loosely. Each links to the actual
implementing code so this doc can't drift silently out of sync — if the
linked function changes shape, update this doc in the same PR.

## Order lifecycle — three independent dimensions

| Dimension | States | Never conflate with |
|---|---|---|
| `Order.status` | `DRAFT` → `CONFIRMED` → `CLOSED` (or `CANCELED`) | payment or fulfillment state |
| `Order.paymentStatus` | `UNPAID` → `PARTIALLY_PAID` → `PAID` → `REFUNDED` | order or fulfillment state |
| `Order.fulfillmentStatus` | `UNALLOCATED` → `RESERVED` → `READY` → `PICKED_UP`/`DELIVERED` | order or payment state |

A `CONFIRMED` order can be `UNPAID` (this build's current checkout — see
below) or `PAID` (once a payment provider exists). Nothing in the codebase
infers one status from another.

## Online checkout (implemented, payment step deferred)

`POST /api/checkout` in `apps/api/src/routes/orders.routes.js`:

1. Validate requested lines reference active variants.
2. Upsert the `Customer` record by email.
3. Create the `Order` (status `DRAFT`, paymentStatus `UNPAID`,
   fulfillmentStatus `UNALLOCATED`) with priced `OrderLine` snapshots.
4. Attempt to `reserveStock()` for every line against the warehouse location,
   inside `inventoryService.reserveStock` (its own transaction per line).
5. If any reservation fails (out of stock), cancel the order and return 409
   — **the order is never left in a half-reserved state.**
6. If all reservations succeed, flip the order to `CONFIRMED` /
   `RESERVED` and return it, with an explicit `paymentNote` telling the
   caller payment isn't wired up yet.

What's intentionally not here yet: actual payment capture, tax calculation,
and conversion of the reservation into a final sale (`SALE` stock movement).
That conversion step (`convertReservationToSale` in
`inventory.service.js`) exists and is unit-correct, but nothing calls it yet
because nothing confirms payment yet — calling it today would mark unpaid
orders as sold, which is exactly the bug class the kickoff plan warns
against ("never mark a sale complete solely because a checkout page
displayed success").

## POS card sale / cash / deposit — not implemented

Reserved for the POS milestone. See `apps/pos/README.md`.

## Receiving stock (implemented)

`POST /api/purchasing/purchase-orders/:id/receive` in
`apps/api/src/routes/purchasing.routes.js`:

1. Reject receiving against a PO that isn't `SENT_TO_VENDOR` or
   `PARTIALLY_RECEIVED`.
2. For each receipt line, reject if `receivedQty + acceptedQty` would exceed
   `expectedQty` — this is what makes "repeated receipts without
   over-receiving" (page 9 of the kickoff plan) hold even if the same
   delivery is accidentally submitted twice with a slightly different split.
3. Accepted quantity increments `StockBalance.onHand` and writes a `RECEIPT`
   movement; damaged quantity increments `StockBalance.quarantined` instead
   (excluded from available-to-sell) — no movement row is written for
   damaged stock, since it isn't a location change, but it's visible in the
   `GoodsReceipt`/`ReceiptLine` records and the balance itself.
4. PO status becomes `RECEIVED` once every line is fully received, or stays
   `PARTIALLY_RECEIVED` otherwise.

## Return / refund — not implemented

The schema (`Refund`, `ProviderEvent`) supports it, but the actual refund
flow depends on the same payment-provider decision blocking live checkout —
see `docs/requirements/open-questions.md`.

## Reservation expiry

`inventoryService.expireStaleReservations()` finds `ACTIVE` reservations past
`expiresAt`, releases the held quantity back to available-to-sell, and marks
them `EXPIRED` — each inside its own transaction. This is not yet wired to a
scheduled job or a lazy per-request check; calling it periodically (cron,
or before catalog/checkout reads) is a Sprint 2 task once a job
runner/scheduler is chosen.
