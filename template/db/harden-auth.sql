-- Lock down better-auth's own tables from the app's data roles.
--
-- The Hold base schema blanket-grants privileges to `authenticated` on public
-- tables (convenient for app tables, which RLS then gates row-by-row). But
-- better-auth's tables (user/session/account/verification) live in the same
-- schema and must NEVER be reachable through the RLS-bound app connection —
-- otherwise `authenticated` could read every user's password hash.
--
-- We revoke those grants and enable RLS with no policies (deny-all to
-- non-owners). better-auth connects as the table owner, which bypasses RLS, so
-- it keeps working. Run this AFTER every `better-auth migrate`.
do $$
declare t text;
begin
  foreach t in array array['user', 'session', 'account', 'verification'] loop
    if to_regclass('public.' || quote_ident(t)) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', t);
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;
