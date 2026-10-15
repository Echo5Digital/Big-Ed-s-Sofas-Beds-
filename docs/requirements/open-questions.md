# Open Questions / Required Client Inputs

These are blockers for specific future work, not for what has already been
built. Carried over from the kickoff plan's "Required client inputs + launch
gate" section (page 13), reorganized by what they block.

## Blocks: Card-present tender on In-Store POS (`apps/pos`)

`apps/pos` is built and working for cash sales, deposits, discounts (with a
required reason code), receipts, and register closeout/reconciliation
(`apps/api/src/services/pos.service.js`). What's still blocked on a client
decision is specifically the card-present tender path:

- Current POS system (if any), preferred payment processor, merchant account,
  and specific in-store card terminal model(s). The kickoff plan is explicit:
  "select the provider and supported reader model early; validate terminal
  API, partial/deposit payments, refunds, failure recovery, webhooks and
  settlement reports" — none of this can be built speculatively, because the
  data shape of a "payment confirmation" depends entirely on the chosen
  provider's API. `POST /api/pos/sales` currently rejects
  `tenderMethod: "CARD"` with a 501 rather than fabricating a successful
  charge. Stripe Terminal is a candidate (online checkout now uses Stripe —
  see "Decisions already made" below) but needs its own reader-model decision
  before it's wired up; it is a separate integration from online Payment
  Intents.
- Register/cash-drawer hardware, if any, beyond the browser-based terminal
  integration.
- Discount authorization is intentionally minimal today: any staff member
  with `pos:sell` can apply a discount as long as they record a reason code,
  with no approval-limit tiers. A tiered policy (who can discount how much
  without manager approval) is still a client decision if the business wants
  one.

## Blocks: Live payment on the e-commerce checkout — RESOLVED

Online checkout now creates a real Stripe PaymentIntent (test mode) and
collects card details via Stripe Elements — see "Decisions already made"
below for the shape. Still open:

- Deposit policy, cancellation/refund/exchange rules for online orders —
  needed to build out `Refund` handling for e-commerce (POS refunds already
  work; online refunds through Stripe are not yet implemented).
- Real Stripe account + live-mode keys — this build uses test-mode
  placeholders (`sk_test_...`/`pk_test_...`/`whsec_...` in `.env.example`)
  until a real Stripe account is connected and the mandatory production
  launch checklist is complete.

## Blocks: Tax calculation

- Sales-tax jurisdiction(s) and whether a supported tax calculation service
  (e.g. a tax API) is required, or a flat rate is acceptable for MVP.
  `Order.taxCents` exists in the schema; nothing computes it yet.

## Blocks: Delivery/fulfillment console

- Delivery area boundaries, delivery fee structure, and assembly service
  policy — needed before `apps/admin/app/deliveries` becomes more than a
  placeholder.

## Blocks: Finance/accounting integration

- Whether an accounting export (QuickBooks, etc.) is required for MVP or can
  wait — the kickoff plan marks this optional unless the business requires
  it at launch.

## Blocks: Final branding

- Clean, commercially-licensed logo and mascot artwork, with proof of usage
  rights. The current site uses:
  - `apps/storefront/public/images/brand/big-eds-logo.webp` (the approved
    lockup image provided for this build)
  - `apps/storefront/components/ui/BearMascot.jsx` — an original placeholder
    SVG, clearly commented in-file as a stand-in, **not** final mascot
    artwork.
- Real social media profile URLs (currently `#` placeholders in
  `apps/storefront/lib/mock-data/site-config.js`, deliberately left as the
  one category of placeholder link not pointed at a real internal page,
  since no real accounts exist yet to link to).

## Blocks: Real catalog data

- Starter product catalog: SKUs, variants, photography, brands, accurate
  dimensions, supplier costs, retail prices, current on-hand quantities per
  location. Everything in `packages/database/prisma/seed.js` and
  `apps/storefront/lib/mock-data/` is placeholder/demo data, clearly
  commented as such in those files.
- Warehouse/showroom physical layout and who owns physical stock counts.

## Blocks: Production launch (none of these block current development)

Per the kickoff plan's "Mandatory production launch checklist" — tracked
here so they aren't lost, not because they're due now:

- Approved production test cases for checkout, refunds, failed payments,
  duplicate webhook events, and concurrent stock reservation.
- Inventory migration verified via physical count before enabling checkout.
- Payment terminals/webhooks tested against the actual provider's
  sandbox/live certification process.
- Automated backup + tested restore, monitoring, alerting configured for the
  production database.
- Staff can complete an end-to-end POS sale, PO receipt, delivery/pickup, and
  register closeout without developer assistance.
- Documented go/no-go decision, rollback window, launch-day owner, support
  coverage.

## Decisions already made (recorded so they aren't re-litigated)

- Backend framework: **Express.js**, not NestJS (client's explicit choice —
  see `docs/architecture/overview.md`).
- Repo structure: pnpm workspace monorepo (`apps/*`, `packages/*`), matching
  the kickoff plan.
- Staff auth: JWT access + refresh tokens in httpOnly cookies, not
  server-session-store based.
- Checkout: online checkout uses **Stripe** (Payment Intents, test mode) —
  `POST /api/checkout` creates the order + inventory reservation, then
  creates a Stripe PaymentIntent and returns its `clientSecret`; the
  storefront collects card details with Stripe Elements and calls
  `stripe.confirmPayment()` client-side. The order is only marked `PAID` by
  `POST /api/webhooks/stripe` reacting to `payment_intent.succeeded` — a
  client-side "payment succeeded" response is never trusted on its own
  (`apps/api/src/routes/webhooks.routes.js`), per the non-negotiable "never
  assume terminal pending means paid" rule. Webhook events are recorded in
  `ProviderEvent` keyed on Stripe's `event.id`; a duplicate delivery hits the
  existing unique-constraint→409 mapping and is acknowledged as a no-op
  rather than re-applied. If the PaymentIntent can't be created (e.g. a
  misconfigured key), the order and its stock reservations are rolled back
  immediately rather than left `CONFIRMED`/`RESERVED` with no way to pay.
  Same guardrail still applies to POS card-present tender (separate
  integration — Stripe Terminal, not yet wired up).
- POS: built with cash/deposit tender real and card tender stubbed (see
  above), rather than waiting on the payment provider decision to start any
  POS work — register sessions, cash sales, deposits, discounts (with
  required reason code), and closeout reconciliation don't depend on that
  decision and don't need to wait for it. Added a `CASHIER` role and `pos:*`
  permission keys (`packages/database/prisma/seed.js`) rather than
  overloading `STAFF` or `MANAGER` with register access.
- Storefront: now calls the real catalog/checkout API
  (`apps/storefront/lib/api/`) instead of local mock data — product
  browsing, search, cart, and checkout all hit `apps/api`. Mock data files
  under `apps/storefront/lib/mock-data/` remain for non-catalog marketing
  content (blog, testimonials, site copy) only.
