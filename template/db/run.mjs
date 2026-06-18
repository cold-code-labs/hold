// Apply a .sql file to the project db over HOLD_AUTH_DB_URL (the privileged
// connection). Used for one-off setup steps like hardening the auth tables.
//   node db/run.mjs db/harden-auth.sql
import { readFile } from "node:fs/promises";
import pg from "pg";

const file = process.argv[2];
if (!file) {
  console.error("usage: node db/run.mjs <file.sql>");
  process.exit(1);
}
const url = process.env.HOLD_AUTH_DB_URL;
if (!url) {
  console.error("HOLD_AUTH_DB_URL is not set");
  process.exit(1);
}

const sql = await readFile(file, "utf8");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(sql);
  console.log(`applied ${file}`);
} finally {
  await client.end();
}
