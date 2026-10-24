-- Clinic database roles (Module 4) live in the same Postgres instance as the
-- catalog. Only the platform's own roles may connect to the catalog: PUBLIC
-- (and therefore every clinic role) loses CONNECT and TEMP. The owner keeps
-- its implicit rights; cabinova_app is granted CONNECT explicitly.
DO $$
BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cabinova_app') THEN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO cabinova_app', current_database());
  END IF;
END
$$;
