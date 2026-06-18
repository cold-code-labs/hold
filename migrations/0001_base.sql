-- Hold base schema — applied to every NEW project database.
--
-- RLS keyed to the JWT 'sub' claim. The app connects as the project's
-- authenticator role and `SET ROLE authenticated` (a NON-owner role) per
-- transaction, then injects the claims via set_config(...). Because the
-- acting role is neither the table owner nor a superuser, the policies
-- actually apply.
--
--   begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<uuid>"}', true);
--   ... queries ...
--   commit;

create extension if not exists pgcrypto;
create schema if not exists hold;

create or replace function hold.current_user_id() returns uuid
  language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid;
$$;

create table if not exists todos (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default hold.current_user_id(),
  title      text not null,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

alter table todos enable row level security;

create policy todos_owner_select on todos
  for select to authenticated
  using (owner = hold.current_user_id());

create policy todos_owner_modify on todos
  for all to authenticated
  using (owner = hold.current_user_id())
  with check (owner = hold.current_user_id());

-- Privileges for the shared non-owner roles (RLS gates the rows).
grant usage on schema public, hold to anon, authenticated;
grant execute on all functions in schema hold to anon, authenticated;
grant select, insert, update, delete on todos to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
