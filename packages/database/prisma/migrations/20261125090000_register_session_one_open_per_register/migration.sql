-- Enforce at most one OPEN or PENDING_REOPEN_APPROVAL RegisterSession per
-- Register at the database level. openRegister()'s prior check-then-create
-- (findFirst, then create) had a TOCTOU gap: two concurrent opens for the
-- same register could both pass the findFirst check before either create
-- committed, leaving two live sessions for one physical drawer and making
-- cash reconciliation at closeout meaningless. Prisma's schema DSL can't
-- express a partial (WHERE-filtered) unique index, so it's added here as
-- raw SQL instead of a @@unique in schema.prisma.
CREATE UNIQUE INDEX "RegisterSession_registerId_open_unique"
ON "RegisterSession" ("registerId")
WHERE "status" IN ('OPEN', 'PENDING_REOPEN_APPROVAL');
