-- Local-only stand-in for Supabase's auth schema, so the migration and RLS tests can run on plain Postgres 16.
-- NOT for Supabase. Usage (empty scratch database):
--   psql -d scratch -v ON_ERROR_STOP=1 -f stubs.sql -f ../20261114120000_phase1_schema.sql -f rls_tests.sql
-- The last statement prints one PASS/FAIL row per check.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif((nullif(current_setting('request.jwt.claims', true),'')::jsonb ->> 'sub'),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),'')::jsonb,'{}'::jsonb) $$;
grant usage on schema auth, public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
