-- The API connects as cabinova_app, whose default privileges only covered
-- tables. Sequences (invoice_number_seq) need USAGE too, now and for any
-- future sequence created by the migration owner.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cabinova_app') THEN
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cabinova_app;
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO cabinova_app',
      current_user
    );
  END IF;
END
$$;
