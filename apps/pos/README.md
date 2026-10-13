# In-Store POS — Deferred

This app is intentionally not built out yet. Per project scope, the current build
covers:

- E-Commerce Website (`apps/storefront`)
- Inventory Management (`apps/admin` + `apps/api`)
- Purchase Order System (`apps/admin` + `apps/api`)

The in-store cashier POS (register sessions, card-present/cash/deposit tender,
receipts, refunds, register closeout/reconciliation) will be built in a later
milestone, once the payment processor and card terminal hardware are selected
and validated — see `docs/requirements/open-questions.md`.

The database schema already reserves the POS data model (`Register`,
`RegisterSession`, `CashMovement`, `Receipt` in
`packages/database/prisma/schema.prisma`) so this app can be implemented
without a schema migration once that work starts. No API routes exist for
these tables yet.

## Planned stack (matching the rest of the platform)

- Next.js + React, JavaScript
- Tailwind CSS + shadcn/ui
- Talks to the same `apps/api` Express backend and shared PostgreSQL database
