import crypto from "node:crypto";
import { adminClient, dbClient, controlPool } from "./db";
import { applyMigrations } from "./migrate";
import { ensureGlobalRoles } from "./roles";
import { projectMigrationsDir } from "./paths";
import { config } from "./config";
import {
  poolerEnabled,
  registerTenant,
  poolerConnectionString,
} from "./supavisor";

const SLUG = /^[a-z][a-z0-9_]{1,40}$/;

export type Project = {
  name: string;
  database: string;
  role: string;
  applied: string[];
  connectionString: string;
  pooled: boolean;
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
  const externalId = name; // Supavisor tenant id

  // Reuse the stored authenticator password if the project already exists, so
  // re-provisioning is idempotent and the tenant can be re-registered.
  const prev = await controlPool.query(
    "select db_password from projects where name = $1",
    [name],
  );
  const password =
    (prev.rows[0]?.db_password as string | undefined) ??
    crypto.randomBytes(18).toString("base64url");

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
    } else if (!prev.rows[0]?.db_password) {
      // Role exists but we never stored its password — reset to a known one.
      await admin.query(`alter role ${ident(role)} password ${lit(password)}`);
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
    `insert into projects (name, database, role, db_password, tenant_external_id)
       values ($1, $2, $3, $4, $5)
     on conflict (name) do update
       set db_password = excluded.db_password,
           tenant_external_id = excluded.tenant_external_id`,
    [name, database, role, password, externalId],
  );

  // Route the project through the pooler when one is configured.
  let pooled = false;
  let connectionString = connStr(database, role, password);
  if (poolerEnabled()) {
    await registerTenant({ externalId, database, dbUser: role, dbPassword: password });
    connectionString = poolerConnectionString({
      externalId,
      database,
      dbUser: role,
      dbPassword: password,
    });
    pooled = true;
  }

  return { name, database, role, applied, connectionString, pooled };
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
