export const config = {
  adminUrl:
    process.env.HOLD_DB_ADMIN_URL ??
    "postgres://postgres:postgres@localhost:5433/postgres",
  controlDb: process.env.HOLD_CONTROL_DB ?? "hold",
  apiPort: Number(process.env.HOLD_API_PORT ?? 8787),
};

/** Returns the admin connection string pointed at a specific database. */
export function urlForDb(database: string): string {
  const u = new URL(config.adminUrl);
  u.pathname = "/" + database;
  return u.toString();
}
