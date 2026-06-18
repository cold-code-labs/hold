export const config = {
  adminUrl:
    process.env.HOLD_DB_ADMIN_URL ??
    "postgres://postgres:postgres@localhost:5433/postgres",
  controlDb: process.env.HOLD_CONTROL_DB ?? "hold",
  apiPort: Number(process.env.HOLD_API_PORT ?? 8787),

  // Auth — project zero (GoTrue) + panel JWT verification
  jwtSecret: process.env.HOLD_JWT_SECRET ?? "",
  zeroDb: process.env.HOLD_ZERO_DB ?? "hold_zero",
  gotrueUrl: process.env.HOLD_GOTRUE_URL ?? "http://localhost:9999",
  masterEmail: process.env.HOLD_MASTER_EMAIL ?? "admin@example.com",
  masterPassword: process.env.HOLD_MASTER_PASSWORD ?? "",
};

/** Returns the admin connection string pointed at a specific database. */
export function urlForDb(database: string): string {
  const u = new URL(config.adminUrl);
  u.pathname = "/" + database;
  return u.toString();
}
