-- RenameEnumValue
-- Renames the RoleName enum value STAFF -> SALESMAN. Role.name is typed
-- directly as RoleName, so every existing Role row (and the UserRole/
-- RolePermission rows that reference it) is repointed automatically — no
-- data backfill needed beyond this single rename.
ALTER TYPE "RoleName" RENAME VALUE 'STAFF' TO 'SALESMAN';
