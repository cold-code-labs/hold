export const config = {
  adminUrl:
    process.env.HOLD_DB_ADMIN_URL ??
    "postgres://postgres:postgres@localhost:5433/postgres",
  controlDb: process.env.HOLD_CONTROL_DB ?? "hold",
  apiPort: Number(process.env.HOLD_API_PORT ?? 8787),

  // Bearer key guarding the /v1 management API. When set, every /v1 request
  // must carry `Authorization: Bearer <key>`. Empty = open (dev only).
  apiKey: process.env.HOLD_API_KEY ?? "",

  // Auth — project zero (GoTrue) + panel JWT verification
  jwtSecret: process.env.HOLD_JWT_SECRET ?? "",
  zeroDb: process.env.HOLD_ZERO_DB ?? "hold_zero",
  gotrueUrl: process.env.HOLD_GOTRUE_URL ?? "http://localhost:9999",
  masterEmail: process.env.HOLD_MASTER_EMAIL ?? "admin@example.com",
  masterPassword: process.env.HOLD_MASTER_PASSWORD ?? "",

  // Supavisor pooler. Empty apiUrl/secret = disabled (direct connection).
  poolerApiUrl: process.env.HOLD_POOLER_API_URL ?? "",
  poolerApiSecret: process.env.SUPAVISOR_API_JWT_SECRET ?? "",
  poolerMetaDb: process.env.SUPAVISOR_META_DB ?? "_supabase",
  poolerUpstreamHost: process.env.HOLD_POOLER_UPSTREAM_HOST ?? "db",
  poolerUpstreamPort: Number(process.env.HOLD_POOLER_UPSTREAM_PORT ?? 5432),
  poolerHost: process.env.HOLD_POOLER_HOST ?? "localhost",
  poolerPort: Number(process.env.HOLD_POOLER_PORT ?? 6543),
};

/** Returns the admin connection string pointed at a specific database. */
export function urlForDb(database: string): string {
  const u = new URL(config.adminUrl);
  u.pathname = "/" + database;
  return u.toString();
}
