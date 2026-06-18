-- better-auth schema (email/password + sessions), idempotent.
--
-- Applied at instance boot before the app starts. Mirrors what
-- `@better-auth/cli migrate` produces for this template's config
-- (email/password, UUID ids). Keep in sync if better-auth plugins change.
--
-- Tables are created by the connection in HOLD_AUTH_DB_URL (the project's
-- dedicated auth role), so they are NOT covered by the base schema's default
-- privileges for `authenticated` — the app's data role can't see them.

create table if not exists public."user" (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  email           text not null unique,
  "emailVerified" boolean not null,
  image           text,
  "createdAt"     timestamptz not null default current_timestamp,
  "updatedAt"     timestamptz not null default current_timestamp
);

create table if not exists public.session (
  id          uuid primary key default gen_random_uuid(),
  "expiresAt" timestamptz not null,
  token       text not null unique,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId"    uuid not null references public."user"(id) on delete cascade
);

create table if not exists public.account (
  id                      uuid primary key default gen_random_uuid(),
  "accountId"             text not null,
  "providerId"            text not null,
  "userId"                uuid not null references public."user"(id) on delete cascade,
  "accessToken"           text,
  "refreshToken"          text,
  "idToken"               text,
  "accessTokenExpiresAt"  timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope                   text,
  password                text,
  "createdAt"             timestamptz not null default current_timestamp,
  "updatedAt"             timestamptz not null
);

create table if not exists public.verification (
  id          uuid primary key default gen_random_uuid(),
  identifier  text not null,
  value       text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp
);

create index if not exists "account_userId_idx" on public.account ("userId");
create index if not exists "session_userId_idx" on public.session ("userId");
create index if not exists verification_identifier_idx on public.verification (identifier);
