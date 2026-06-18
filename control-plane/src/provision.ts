import crypto from "node:crypto";
import { adminClient, dbClient, controlPool } from "./db";
import { applyMigrations } from "./migrate";
import { ensureGlobalRoles } from "./roles";
import { projectMigrationsDir } from "./paths";
import { config } from "./config";

const SLUG = /^[a-z][a-z0-9_]{1,40}$/;

export type Project = {
  name: string;
  database: string;
  role: string;
  applied: string[];
  connectionString: string;
};

/**
 * Provision a new project:
 *  - a dedicated authenticator login role (NOINHERIT; member of anon/authenticated)
 *  - a dedicated database (owned by postgres; only the authenticator may connect)
 *  - the base schema applied (tables owned by postgres → RLS applies to the app)
 *  - a row in the control registry
 * Idempotent on role/database.
 */
export async function createProject(name: string): Promise<Project> {
  if (!SLUG.test(name)) {
    throw new Error(
      `invalid project name '${name}' (a-z, 0-9, _, must start with a letter)`,
    );
  }

  const database = `proj_${name}`;
  const role = `proj_${name}`; // the authenticator (login) role
  const password = crypto.randomBytes(18).toString("base64url");

  const admin = adminClient();
  await admin.connect();
  try {
    await ensureGlobalRoles(admin);

    const r = await admin.query("select 1 from pg_roles where rolname = $1", [
      role,
    ]);
    if (!r.rowCount) {
      await admin.query(
        `create role ${ident(role)} login noinherit password ${lit(password)}`,
      );
      await admin.query(`grant anon, authenticated to ${ident(role)}`);
    }

    const d = await admin.query(
      "select 1 from pg_database where datname = $1",
      [database],
    );
    if (!d.rowCount) {
      await admin.query(`create database ${ident(database)}`);
    }

    // Only this project's authenticator may connect to this database.
    await admin.query(`revoke connect on database ${ident(database)} from public`);
    await admin.query(
      `grant connect on database ${ident(database)} to ${ident(role)}`,
    );
  } finally {
    await admin.end();
  }

  // Apply base schema (as superuser → tables owned by postgres, not by the app role).
  const target = dbClient(database);
  await target.connect();
  let applied: string[] = [];
  try {
    applied = await applyMigrations(target, projectMigrationsDir);
  } finally {
    await target.end();
  }

  await controlPool.query(
    `insert into projects (name, database, role) values ($1, $2, $3)
     on conflict (name) do nothing`,
    [name, database, role],
  );

  return {
    name,
    database,
    role,
    applied,
    connectionString: connStr(database, role, password),
  };
}

export async function listProjects() {
  const { rows } = await controlPool.query(
    "select name, database, role, created_at from projects order by created_at",
  );
  return rows;
}

function ident(s: string) {
  return '"' + s.replace(/"/g, '""') + '"';
}
function lit(s: string) {
  return "'" + s.replace(/'/g, "''") + "'";
}
function connStr(database: string, role: string, pw: string) {
  const u = new URL(config.adminUrl);
  return `postgres://${role}:${pw}@${u.hostname}:${u.port}/${database}`;
}
