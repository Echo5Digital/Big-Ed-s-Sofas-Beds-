-- CreateEnum
CREATE TYPE "CustomerChannel" AS ENUM ('ONLINE', 'POS');

-- AlterTable: add as nullable first so existing rows can be backfilled,
-- then tightened to NOT NULL below once every row has a value.
ALTER TABLE "Customer" ADD COLUMN "channel" "CustomerChannel";

-- Backfill: a row with a password or a verified email can only have come
-- from online registration, so it's unambiguously ONLINE. Every other
-- existing row (guest checkouts and POS-created customers alike, which
-- were indistinguishable before this migration) defaults to ONLINE too —
-- guest checkout is this app's far more common source of a credential-less
-- Customer row than POS, and defaulting to ONLINE means no pre-existing
-- online guest's order history is misfiled as a POS customer by this
-- backfill. Any pre-existing row that actually originated from POS and
-- gets mis-tagged ONLINE by this heuristic is a one-time, admin-correctable
-- classification on old data, not an ongoing bug — every row created after
-- this migration is tagged correctly at creation time by the application
-- code, which is what actually matters going forward.
UPDATE "Customer" SET "channel" = 'ONLINE' WHERE "channel" IS NULL;

-- AlterTable: now safe to require it on every row, including future ones.
ALTER TABLE "Customer" ALTER COLUMN "channel" SET NOT NULL;

-- DropIndex: the old global unique-by-email constraint is replaced by a
-- per-channel one below — the same email may now exist once per channel.
DROP INDEX "Customer_email_key";

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_channel_key" ON "Customer"("email", "channel");
