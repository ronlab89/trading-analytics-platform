-- Least-privilege runtime role.
--
-- The migration role (the one running this script) keeps DDL. The API and the
-- test suites connect as `trading_runtime`, which can only read and write rows.
-- No password is stored here: `prisma/set-runtime-password.ts` sets it from
-- RUNTIME_DB_PASSWORD after `prisma migrate deploy`.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trading_runtime') THEN
    CREATE ROLE trading_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO trading_runtime', current_database());
END
$$;

REVOKE CREATE ON SCHEMA public FROM trading_runtime;
GRANT USAGE ON SCHEMA public TO trading_runtime;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO trading_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO trading_runtime;

-- Migration bookkeeping stays invisible to the runtime role.
REVOKE ALL ON TABLE "_prisma_migrations" FROM trading_runtime;

-- Tables and sequences created by future migrations inherit the same grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO trading_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO trading_runtime;
