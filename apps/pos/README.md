# In-Store POS

Cashier checkout app for Big Ed's Sofas & Beds, built against the shared
`apps/api` backend and PostgreSQL database — same stack, auth, and RBAC
conventions as `apps/admin`.

## What's real vs. stubbed

Per `docs/requirements/open-questions.md`, no payment processor or in-store
card terminal model has been selected yet. Building a working card-present
flow against an unselected provider would mean fabricating integration that
doesn't exist, which the kickoff plan explicitly warns against. So:

- **Register open/close, cash sales, deposits, receipts, and register
  closeout/reconciliation are fully real** — they hit the live database via
  `apps/api/src/services/pos.service.js` and the same
  `inventory.service.js` reserve/convert-to-sale transactions the online
  storefront checkout uses, so POS and web sales draw from one shared stock
  truth.
- **Card-present tender is visibly disabled**, both in the UI (`TenderModal`
  shows a clear "not available yet" notice for the Card option) and at the
  API layer (`POST /api/pos/sales` returns `501 Not Implemented` for
  `tenderMethod: "CARD"`). Once a provider and terminal model are confirmed,
  that stub becomes the integration point.

## Running locally

```bash
pnpm install
pnpm --filter @big-eds/pos dev   # http://localhost:3002
```

Requires `apps/api` running locally (or pointed at via `NEXT_PUBLIC_API_URL`)
and a seeded database (`pnpm db:seed`) — the seed creates a `CASHIER`-role
demo user (`cashier@bigedsfurniture.com`, see `packages/database/prisma/seed.js`
for the password) and a demo `Register` tied to the showroom location.

## Permissions

New `pos:*` permission keys (`pos:register:open`, `pos:register:close`,
`pos:sell`, `pos:refund`) and a `CASHIER` role were added in this build —
see `packages/database/prisma/seed.js`. Existing `ADMIN`/`MANAGER` roles do
not automatically gain POS permissions; grant the `CASHIER` role (or add
`pos:*` keys to another role) for any staff member who needs register access.
