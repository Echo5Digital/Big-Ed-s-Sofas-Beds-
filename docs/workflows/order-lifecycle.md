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

## POS cash sale / deposit (implemented) / card sale (stubbed)

`POST /api/pos/sales` in `apps/api/src/routes/pos.routes.js`, backed by
`apps/api/src/services/pos.service.js`:

1. Reject the request outright (409 at the service layer, 501 at the route)
   if `tenderMethod` is `CARD` — no payment processor or terminal model has
   been selected (see `docs/requirements/open-questions.md`), so this path
   must never fabricate a successful card charge.
2. For `CASH`/`DEPOSIT`: price the lines server-side from live `Variant`
   data (never trust a client-sent price), create a `DRAFT` order with
   `channel: "POS"` and `fulfillmentMethod: "IN_STORE"`.
3. Reserve and convert stock for every line concurrently (`Promise.allSettled`)
   against the register's assigned location via
   `inventoryService.reserveAndConvertForSale` — a POS cashier completes
   checkout in one motion, unlike the online cart's held reservation, so
   reserve+convert happens in a single transaction per line instead of two
   separately-committed ones (online checkout still reserves now and converts
   later via `reserveStock`/`convertReservationToSale` separately, once
   payment is confirmed — see "Online checkout" above). Each line's
   transaction still takes the same `FOR UPDATE` lock on its `StockBalance`
   row, so POS and web sales for the same variant still serialize on that row
   and can never double-sell the last unit across channels; lines for
   different variants run in parallel since they lock different rows.
4. If any line fails, compensate every line that did succeed with an
   offsetting `adjustStock` call and cancel the order — a half-rung-up sale
   is never left ambiguous, regardless of which concurrent lines happened to
   succeed or fail.
5. Write a `Payment` (`status: SUCCEEDED`), a `CashMovement` on the register
   session (type `SALE` or `DEPOSIT`), and a `Receipt`. `paymentStatus`
   becomes `PAID` (full tender) or `PARTIALLY_PAID` (deposit less than the
   order total) — never inferred from `status` or `fulfillmentStatus`.

Register sessions (`POST /api/pos/registers/open`,
`POST /api/pos/sessions/:id/close`) and refunds (`POST /api/pos/refunds`)
follow the same real/working pattern — register closeout reconciles counted
cash against the session's `CashMovement` rows and records any discrepancy
rather than silently absorbing it; refunds are capped at the order total and
write a compensating `REFUND` cash movement.

### Register reopen approval (implemented)

A register session left `OPEN` from a previous shift (never closed out —
e.g. the cashier's browser tab closed without clicking "Close out
register") cannot be force-closed by a cashier directly. Instead:

1. A cashier who selects a stuck register in `apps/pos`'s "Open your
   register" screen sees a "Request reopen approval" action instead of a
   close button. `POST /api/pos/sessions/:id/request-reopen` (requires
   `pos:register:close`) moves the session to
   `RegisterSessionStatus.PENDING_REOPEN_APPROVAL` and stamps
   `reopenRequestedById`/`reopenRequestedAt`. The register stays unusable —
   `openRegister` rejects both `OPEN` and `PENDING_REOPEN_APPROVAL` — and the
   cashier's screen polls until the status changes.
2. Every register in this state surfaces in the admin dashboard's
   notification bell (polled, `GET /api/pos/registers/pending-reopens`) and
   on the `/registers` page, gated behind the `pos:register:approve-reopen`
   permission (seeded onto `ADMIN` and `MANAGER`, not `CASHIER`/`STAFF`).
3. **Approve** (`POST /api/pos/sessions/:id/approve-reopen`) actually closes
   the stuck session — same cash reconciliation as a normal close (counted
   cash vs. `openingCashCents` + `CashMovement` total, discrepancy recorded)
   — and stamps `reopenApprovedById`/`reopenApprovedAt`. The register becomes
   available again immediately.
4. **Deny** (`POST /api/pos/sessions/:id/deny-reopen`) sends the session back
   to `OPEN` rather than closing it — the register stays locked, signaling
   that someone needs to physically check the drawer before it can be
   reconciled — and stamps `reopenDeniedAt`/`reopenDenialReason`.

Both actions write an `AuditLog` entry (`pos.register.reopen.request`
/ `.approve` / `.deny`).

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
