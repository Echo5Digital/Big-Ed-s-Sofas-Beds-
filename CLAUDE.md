# Rules for AI-assisted development on this repo

Adapted from `Big_Eds_Developer_Kickoff_Plan.pdf`, section 11 ("Claude Code
workflow and release rules"). Human engineering ownership remains mandatory
regardless of how much of the implementation an AI assistant writes.

## Before changing code

- Read `docs/architecture/overview.md`, `docs/database/schema.md`, and
  `docs/workflows/order-lifecycle.md` first. Propose a short implementation
  plan before touching business-critical code (inventory, purchasing,
  orders, auth).
- One isolated task/branch/PR at a time.
- Ask before introducing a new major dependency or changing the Prisma
  schema design — schema changes ripple through every app in this monorepo.

## While changing code

- Generate tests for business-critical actions (stock adjustments,
  transfers, reservations, receiving, order creation) and actually run them.
  Report real failures — never assert success without having run the
  command and seen the result.
- Never insert real credentials, real customer data, or real payment
  details into prompts, commits, or this repository. Every `.env.example`
  in this repo contains placeholder values only; real secrets live in
  untracked `.env` files.
- Preserve the "non-negotiable engineering rules" baked into
  `packages/database/prisma/schema.prisma` and
  `apps/api/src/services/inventory.service.js`: money as integer cents,
  available-to-sell computed (never stored) as `onHand - reserved -
  quarantined`, stock mutations inside Prisma transactions, append-only
  `StockMovement` history, idempotent payment/provider event handling.

## What requires explicit human approval before proceeding

- Any production database migration.
- Any payment integration test using live/real funds.
- Any deployment to a production or customer-facing environment.
- Enabling the live checkout payment path (currently intentionally stubbed
  — see `docs/requirements/open-questions.md`).

## Definition of done for a ticket

- Linked requirement/acceptance scenario.
- Code reviewed; validation, RBAC, and error handling implemented where the
  endpoint is staff-facing or mutates data.
- Passing lint, typecheck (where applicable), build, and any relevant
  migration.
- Docs/changelog updated if the change affects architecture, schema, or a
  documented workflow.
- No fabricated claims of third-party capability (e.g. don't claim a
  payment provider is "integrated" if it's stubbed) or unverified
  production-readiness claims.

## Monorepo-specific notes

- `apps/storefront` and `apps/admin` are independent Next.js apps — do not
  introduce cross-imports between them. Shared code belongs in `packages/`.
- `apps/api` is the only app permitted to import `@big-eds/database`
  directly. Next.js apps talk to it over HTTP only.
- Keep `packages/validation` schemas and `packages/database/prisma/schema.prisma`
  in sync — a Zod schema accepting a field the Prisma schema doesn't have
  (or vice versa) is a bug.
