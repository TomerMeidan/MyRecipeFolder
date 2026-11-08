-- Read-only role for the nightly backup (.github/workflows/backup.yml).
-- Run once in: Supabase dashboard → SQL Editor. Then set its password separately:
--   ALTER ROLE myrecipe_backup PASSWORD '<long random letters and digits>';
-- Never put the password in this file.

BEGIN;
-- BYPASSRLS: without it the owner-only RLS policies make pg_dump refuse to dump the tables.
CREATE ROLE myrecipe_backup LOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO myrecipe_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO myrecipe_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO myrecipe_backup;
-- Tables created later in the SQL Editor (owned by postgres) stay readable too.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO myrecipe_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON SEQUENCES TO myrecipe_backup;
COMMIT;

-- Verify: must return false for INSERT and true for SELECT.
-- SELECT has_table_privilege('myrecipe_backup', 'public.recipes', 'INSERT'),
--        has_table_privilege('myrecipe_backup', 'public.recipes', 'SELECT');
