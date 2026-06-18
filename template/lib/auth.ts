import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins";
import { Pool } from "pg";

/**
 * better-auth, in-app. It owns its own tables (user/session/account/...) in the
 * project's database, reached over a privileged connection (HOLD_AUTH_DB_URL).
 *
 * User ids are UUIDs so they slot straight into the RLS convention: the data
 * layer puts `user.id` into the JWT `sub` claim, and `hold.current_user_id()`
 * reads it as a uuid.
 *
 * `bearer()` issues tokens for non-cookie clients (e.g. a future mobile app);
 * `nextCookies()` wires cookie handling for the Next App Router and must be last.
 */
export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.HOLD_AUTH_DB_URL }),
  emailAndPassword: { enabled: true },
  advanced: {
    database: { generateId: "uuid" },
  },
  plugins: [bearer(), nextCookies()],
});
