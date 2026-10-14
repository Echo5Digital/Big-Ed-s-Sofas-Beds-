# Big Ed's Retail OS

A connected e-commerce, inventory, and purchasing platform for Big Ed's
Sofas & Beds. Built per `Big_Eds_Developer_Kickoff_Plan.pdf` — see
`docs/architecture/overview.md` for how this implementation maps to that plan
(and where/why it deviates).

**Current scope:** E-Commerce Website, Inventory Management, Purchase Order
System, and In-Store POS (cash/deposit tender; card tender is stubbed
pending a payment processor decision — see `apps/pos/README.md`).

## Stack

- **Frontend:** Next.js + React (JavaScript), Tailwind CSS v4
- **Backend:** Node.js + Express.js
- **Database:** PostgreSQL + Prisma ORM
- **Monorepo:** pnpm workspaces

## Project layout

```
apps/storefront/   Public e-commerce site           (port 3000)
apps/admin/        Staff dashboard — inventory + PO  (port 3001)
apps/pos/          In-store cashier POS              (port 3002)
apps/api/          Express REST API                  (port 4000)
packages/database/ Prisma schema, migrations, seed
packages/validation/  Shared Zod validation schemas
packages/config/   Shared constants
packages/types/    Shared JSDoc type documentation
docs/              Architecture, database, requirements, workflow docs
```

## Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable && corepack prepare pnpm@9.15.0 --activate`, or
  `npm install -g pnpm`)
- A PostgreSQL database (local install, Docker, or a managed/cloud instance
  such as Neon, Supabase, or Railway) — none is bundled with this repo.

## First-time setup

```bash
pnpm install

# Database
cp packages/database/.env.example packages/database/.env
# edit packages/database/.env — set DATABASE_URL to your Postgres instance
pnpm db:migrate
pnpm db:seed
# ^ prints a generated admin login (email/password) — change it immediately
#   outside of local development; override via SEED_ADMIN_EMAIL /
#   SEED_ADMIN_PASSWORD env vars.

# API
cp apps/api/.env.example apps/api/.env
# edit apps/api/.env — set the same DATABASE_URL, and set real JWT secrets
# (never reuse the example secrets outside of local development)

# Admin dashboard
cp apps/admin/.env.example apps/admin/.env.local

# POS
cp apps/pos/.env.example apps/pos/.env.local
```

## Running locally

Run each app in its own terminal (or use a process manager of your choice):

```bash
pnpm dev:api         # http://localhost:4000
pnpm dev:storefront  # http://localhost:3000
pnpm dev:admin       # http://localhost:3001 — sign in with the seeded admin
pnpm dev:pos         # http://localhost:3002 — sign in with the seeded cashier
```

## Other useful commands

```bash
pnpm build           # build every app
pnpm lint            # lint every app
pnpm test            # run apps/api's automated tests (real dev database)
pnpm db:studio       # Prisma Studio — browse/edit data visually
```

## Deploying

See `DEPLOYMENT.md` for the full step-by-step guide: `apps/storefront` and
`apps/admin` deploy to Vercel as separate projects, `apps/api` + Postgres
deploy to Render. Covers cross-domain cookie auth, CORS, environment
variables, and the first-migration bootstrap step.

## Documentation

- `docs/architecture/overview.md` — system architecture, stack decisions and
  why they deviate from the kickoff plan where they do, auth/RBAC model,
  what's explicitly not built yet.
- `docs/database/schema.md` — data model guide.
- `docs/workflows/order-lifecycle.md` — business-critical state machines
  (checkout, receiving, reservations) and the exact code implementing each.
- `docs/requirements/open-questions.md` — decisions still needed from the
  business before specific future work (payments, POS, tax, delivery) can
  start.
- `DEPLOYMENT.md` — Vercel + Render deployment guide.
- `CLAUDE.md` — rules for AI-assisted development on this repo.
