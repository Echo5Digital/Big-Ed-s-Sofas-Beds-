# Open Questions / Required Client Inputs

These are blockers for specific future work, not for what has already been
built. Carried over from the kickoff plan's "Required client inputs + launch
gate" section (page 13), reorganized by what they block.

## Blocks: In-Store POS (`apps/pos`)

- Current POS system (if any), preferred payment processor, merchant account,
  and specific in-store card terminal model(s). The kickoff plan is explicit:
  "select the provider and supported reader model early; validate terminal
  API, partial/deposit payments, refunds, failure recovery, webhooks and
  settlement reports" — none of this can be scaffolded speculatively, because
  the data shape of a "payment confirmation" depends entirely on the chosen
  provider's API.
- Register/cash-drawer hardware, if any, beyond the browser-based terminal
  integration.
- Staff discount authorization policy (who can apply a discount, up to what
  limit, with what approval).

## Blocks: Live payment on the e-commerce checkout

- Same payment provider decision as above — the storefront checkout
  (`apps/storefront/app/checkout/page.jsx`) is intentionally UI-only
  (clearly labeled "payment integration coming soon") until this is decided.
- Deposit policy, cancellation/refund/exchange rules — needed to build the
  real (non-demo) versions of `Payment`/`Refund` handling in
  `apps/api/src/routes/orders.routes.js`.

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
- Checkout: UI-only / no live payment for this build pass, per explicit
  scope guardrail against starting "irreversible payment/provider work"
  before a provider is confirmed.
