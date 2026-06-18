# Hold instance template

A minimal Next.js app backed by a **Hold project** — Postgres with row-level
security, and **better-auth** running in-app. This is the seed that Hold
instances are cloned from.

## How it fits together

- **Auth** is `better-auth`, embedded in the app (no separate auth service). It
  owns its own tables (`user`/`session`/`account`/`verification`) in the
  project database, reached over a privileged connection (`HOLD_AUTH_DB_URL`).
  User ids are UUIDs.
- **Data** goes through the project's pooled connection (`HOLD_DB_URL`, the
  authenticator role via Supavisor in transaction mode). Each request opens a
  transaction, `SET ROLE authenticated`, and injects the signed-in user as
  `request.jwt.claims` — so the database's RLS policies (keyed on
  `hold.current_user_id()`) decide which rows are visible.
- A future mobile / non-Next client can authenticate via the `bearer` plugin
  (token instead of cookie) against the same in-app endpoints.

```
browser ──cookie──► Next app ──┬─ better-auth ──► project db (auth tables, HOLD_AUTH_DB_URL)
                               └─ withUser() ───► pooler (authenticated + RLS, HOLD_DB_URL)
```

## Setup

1. Provision the project with the Hold control plane (`createProject`) — it
   creates the database, the authenticator role, the base schema (with RLS),
   and registers the Supavisor tenant. Copy the pooled connection string.
2. `cp .env.example .env` and fill in:
   - `BETTER_AUTH_SECRET` (`openssl rand -hex 32`)
   - `HOLD_AUTH_DB_URL` — privileged connection for better-auth's tables
   - `HOLD_DB_URL` — the pooled connection string from step 1
3. `pnpm install`
4. `pnpm auth:setup` — runs better-auth's migrations, then **hardens** the auth
   tables (revokes them from the app's data roles + enables RLS, so the
   RLS-bound app connection can never read password hashes). Re-run after any
   `auth:migrate`.
5. `pnpm dev` → http://localhost:3100

## Routes

- `/login` — sign up / sign in (email + password)
- `/app` — protected; lists *your* todos and adds new ones
- `/api/auth/*` — better-auth handler
- `/api/todos` — `GET`/`POST`, session-guarded, RLS-scoped (curl-friendly)

## Production notes

- `HOLD_AUTH_DB_URL` uses the superuser in dev. In production, give better-auth
  a **dedicated role** scoped to its tables instead of the superuser.
- The harden step is point-in-time over the known auth tables. If a better-auth
  plugin adds new tables, re-run `pnpm auth:harden`.
