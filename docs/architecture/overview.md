# Architecture Overview

Source of truth: `Big_Eds_Developer_Kickoff_Plan.pdf` (Echo5 Digital, October 2026).
This document records what was actually implemented and where it deviates
from that plan, with reasoning.

## Stack decisions

| Layer | Kickoff plan | Implemented | Why |
|---|---|---|---|
| Backend framework | NestJS | **Express.js** | Client explicitly requested Node.js + Express over NestJS. |
| Frontend | Next.js + React | Next.js + React (JavaScript, no TypeScript) | Matches both the plan and the client's explicit request. |
| Database | PostgreSQL + Prisma | PostgreSQL + Prisma | Matches exactly. |
| Repo layout | pnpm workspace monorepo | pnpm workspace monorepo | Matches exactly (confirmed with client over the single-app alternative). |
| Styling | Not specified | Tailwind CSS v4 (CSS-based `@theme`, no `tailwind.config.js`) | Matches existing storefront code already in the repo before this build. |

Everything else (data model, workflows, non-negotiable engineering rules,
milestone scope) follows the kickoff plan directly.

## Monorepo layout

```
apps/
  storefront/   Next.js customer-facing e-commerce site (public)
  admin/        Next.js staff dashboard — catalog, inventory, purchasing, orders
  api/          Express.js REST API — the only app that talks to the database
  pos/          Next.js in-store cashier app (port 3002). Register open/close,
                cash sales, deposits, receipts, and closeout reconciliation are
                real; card-present tender is stubbed pending a payment
                processor/terminal decision — see apps/pos/README.md and
                docs/requirements/open-questions.md.

packages/
  database/     Prisma schema, migrations, seed script, generated client
  validation/   Shared Zod schemas used by API route handlers
  config/       Shared constants (reservation TTL, etc.)
  types/        JSDoc-only shared shape documentation
  ui/           Shared brand tokens (colors) — both Next.js apps keep their
                own component implementations today; this package exists for
                genuinely cross-app constants only, not to force premature
                component sharing.

docs/           This documentation
tests/e2e/      Reserved for future end-to-end test suites (not yet populated)
```

## Request flow

```
Customer Web (apps/storefront, :3000)  ─┐
Staff Dashboard (apps/admin, :3001)    ─┼─► Express API (apps/api, :4000) ─► PostgreSQL (Prisma)
In-Store POS (apps/pos, :3002)         ─┘
```

- The admin and POS apps call the API's absolute URL directly
  (`NEXT_PUBLIC_API_URL`, `apps/admin/lib/api/client.js` /
  `apps/pos/lib/api/client.js`) with `credentials: "include"` so the
  httpOnly auth cookies are sent — both server-side (SSR) and from the
  browser. This works the same in local dev (`http://localhost:4000`) and in
  production (e.g. Render), since these apps and the API are different
  origins either way once deployed. The storefront uses the same pattern
  (`apps/storefront/lib/api/client.js`) — catalog browsing, search, cart
  checkout, and payment all call the real API; only non-catalog marketing
  content (blog, testimonials, site copy) still comes from local mock data
  — see `DEPLOYMENT.md`.
- The storefront's public catalog/checkout endpoints (`GET /api/catalog/*`,
  `POST /api/checkout`) require no auth. `POST /api/webhooks/stripe` also
  requires no session auth — its authenticity comes from Stripe's signature
  verification, not RBAC — and is mounted before the global JSON body parser
  since Stripe needs the raw request body to verify that signature. Every
  staff endpoint (`/api/inventory/*`, `/api/purchasing/*`,
  `/api/catalog/admin/*`, `/api/dashboard/*`, `/api/admin/*`, `/api/pos/*`)
  requires a valid session **and** the specific permission for that action —
  enforced server-side in `apps/api/src/middleware/auth.js`, never trusted
  from the client.

## Auth & RBAC

- JWT access token (15 min) + refresh token (7 days), both in httpOnly
  cookies — never exposed to client-side JavaScript. Cookie `Secure`/
  `SameSite` flags default to non-secure/`Lax` in development and
  secure/`None` in production (`apps/api/src/lib/env.js`), since the API and
  the Next.js apps are deployed on different domains (Render + Vercel) —
  `SameSite=None` is required for the browser to send the cookie on a
  cross-site request at all, and browsers reject `None` without `Secure`.
  Override via `COOKIE_SAME_SITE=lax` once both are under one shared parent
  domain via subdomains.
- Permissions are re-read from the database on every request (not baked into
  the JWT), so disabling a user or changing their role takes effect
  immediately rather than waiting for token expiry.
- Four seeded roles: `ADMIN` (all permissions), `MANAGER` (catalog, inventory,
  purchasing including approval, orders, reports), `STAFF` (read-only plus PO
  receiving), `CASHIER` (catalog/inventory/orders read plus `pos:*` —
  register open/close, sell, refund). See `packages/database/prisma/seed.js`
  for the exact permission grants and `docs/database/schema.md` for the full
  permission list.

## Inventory integrity (the part the kickoff plan calls "non-negotiable")

All stock-mutating operations live in `apps/api/src/services/inventory.service.js`
and run inside a single Prisma transaction per operation:

- **Available-to-sell** = `onHand - reserved - quarantined`, computed on read,
  never stored directly.
- **Reservations** carry an `expiresAt` and are lazily swept
  (`expireStaleReservations`) — nothing silently holds stock forever.
- **Sale** = convert an active reservation (decrements `onHand` and `reserved`
  together, in the same transaction) — there is no code path that decrements
  `onHand` for a sale without an active reservation backing it, which is what
  prevents the "last unit sold twice" failure mode called out on page 10 of
  the kickoff plan.
- **Stock movements are append-only** (`StockMovement` table) — corrections
  are new compensating movements, never edits/deletes of history.
- **Receiving** tracks `receivedQty` per PO line and rejects any receipt that
  would push `receivedQty` past `expectedQty`, so repeated/duplicate receiving
  calls can't over-receive.

## Orders: three independent dimensions

Per the kickoff plan's explicit correction, `Order` tracks three separate
enums that are never conflated: `status` (Draft/Confirmed/Canceled/Closed),
`paymentStatus` (Unpaid/PartiallyPaid/Paid/Refunded), `fulfillmentStatus`
(Unallocated/Reserved/Ready/PickedUp/Delivered). See
`packages/database/prisma/schema.prisma`.

## Payments (Stripe, online checkout)

`POST /api/checkout` creates a priced, inventory-reserved order, then creates
a Stripe PaymentIntent (`apps/api/src/lib/stripe.js`) for the order total and
returns its `clientSecret`. The storefront (`apps/storefront/app/checkout/page.jsx`)
collects card details with Stripe Elements and calls `stripe.confirmPayment()`
client-side — but the order's `paymentStatus` stays `UNPAID` until
`POST /api/webhooks/stripe` (`apps/api/src/routes/webhooks.routes.js`) reacts
to a signed `payment_intent.succeeded` event from Stripe itself. This is the
non-negotiable rule from the kickoff plan: "never assume terminal pending
means paid." The webhook route:

- Is mounted before the global `express.json()` parser and uses
  `express.raw()` so Stripe's HMAC signature verification gets the untouched
  request body.
- Records every event in `ProviderEvent` keyed on Stripe's `event.id` before
  handling it — a duplicate delivery hits the column's unique constraint,
  which is caught and acknowledged with 200 (a no-op), not re-applied.
- On success, converts every active `Reservation` on the order to a sale and
  marks the order `PAID`/`READY`. On failure, releases the reservations and
  cancels the order. If the PaymentIntent itself can't be created (e.g. a
  misconfigured key), `/checkout` releases the reservations and cancels the
  order inline rather than leaving it `CONFIRMED`/`RESERVED` with no way to
  pay.

This build uses Stripe **test mode** — see `docs/requirements/open-questions.md`
for the live-mode launch checklist. POS card-present tender is a separate,
still-stubbed integration (Stripe Terminal would need its own reader-model
decision): cash and deposit sales are fully implemented, but
`POST /api/pos/sales` rejects `tenderMethod: "CARD"` with 501 — see
`apps/pos/README.md`.

## What is explicitly NOT built yet (by design)

These are scope guardrails from the kickoff plan, not omissions:

- **Tax calculation** — `Order.taxCents` exists in the schema but nothing
  computes it yet; a real tax engine needs a confirmed jurisdiction/approach
  first (see `docs/requirements/open-questions.md`).
- **PDF generation for POs** — `GET /purchasing/purchase-orders/:id/export`
  returns structured JSON a PDF template would consume; actual PDF rendering
  (e.g. Puppeteer/PDFKit) is deferred until a layout is approved.
- **Delivery scheduling/routing** — the `Delivery`/`Pickup` tables exist;
  no admin UI manages them yet (explicit scope guardrail: "no... complex
  delivery routing in MVP").
- **Object storage/CDN for images** — admin-uploaded product images are
  stored in Cloudinary (see `apps/api/src/lib/cloudinary.js` and the
  `POST /catalog/admin/images` route); products can also reference
  admin-entered external URLs (e.g. Unsplash demo data) directly.

## Local development

See the root `README.md` for exact setup commands. In short: `pnpm install`,
provision a local or cloud PostgreSQL database, copy each `.env.example` to
`.env`, run `pnpm db:migrate && pnpm db:seed`, then run `apps/api`,
`apps/storefront`, and `apps/admin` concurrently.
