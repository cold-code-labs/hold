-- Per-project auth role: a dedicated login role that owns the in-app auth
-- framework's tables (e.g. better-auth) — isolated from the app's data roles
-- and never the superuser. Its password lives here so re-provisioning is
-- idempotent.
alter table projects add column if not exists auth_db_password text;
