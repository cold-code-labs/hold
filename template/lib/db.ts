import { Pool, type PoolClient } from "pg";

/**
 * App data access against the Hold project, RLS-enforced.
 *
 * Connects as the project's authenticator role through Supavisor (transaction
 * mode). Per request we open a transaction, `SET ROLE authenticated` (a
 * non-owner role, so policies bite), and inject the caller's identity as
 * `request.jwt.claims` — exactly what `hold.current_user_id()` reads.
 */
const pool = new Pool({ connectionString: process.env.HOLD_DB_URL });

export async function withUser<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId }),
    ]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
