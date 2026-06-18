// Apply one or more .sql files to the project db over HOLD_AUTH_DB_URL (the
// privileged auth connection). Used at boot to ensure the auth schema and lock
// it down. Idempotent if the SQL is.
//   node db/run.mjs db/auth-schema.sql db/harden-auth.sql
import { readFile } from "node:fs/promises";
import pg from "pg";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node db/run.mjs <file.sql> [more.sql ...]");
  process.exit(1);
}
const url = process.env.HOLD_AUTH_DB_URL;
if (!url) {
  console.error("HOLD_AUTH_DB_URL is not set");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  for (const file of files) {
    await client.query(await readFile(file, "utf8"));
    console.log(`applied ${file}`);
  }
} finally {
  await client.end();
}
