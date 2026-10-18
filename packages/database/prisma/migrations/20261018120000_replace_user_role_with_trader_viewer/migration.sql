-- Hand-written: the generated enum migration fails on existing rows.
-- RENAME VALUE keeps every existing USER row as TRADER (ADR-005 point 1).
ALTER TYPE "user_role" RENAME VALUE 'USER' TO 'TRADER';

-- VIEWER is not used in this transaction, so ADD VALUE is allowed.
ALTER TYPE "user_role" ADD VALUE 'VIEWER' BEFORE 'TRADER';

ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'TRADER';
