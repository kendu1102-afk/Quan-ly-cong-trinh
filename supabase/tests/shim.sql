-- Mô phỏng phần Supabase (auth, role, storage) để chạy thử trên PostgreSQL thường
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text,
  raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true),''), nullif(current_setting('request.jwt.claims', true),'')::jsonb ->> 'sub')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true),''), nullif(current_setting('request.jwt.claims', true),'')::jsonb ->> 'role', 'anon') $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Mô phỏng pg_net: ghi lại các lệnh gọi HTTP để kiểm tra
create schema net;
create table net.goi (id serial primary key, url text, body jsonb, headers jsonb);
create function net.http_post(url text, body jsonb default '{}', headers jsonb default '{}') returns bigint language sql as $$
  insert into net.goi (url, body, headers) values (url, body, headers) returning id::bigint $$;
