import crypto from "node:crypto";
import { adminClient, dbClient, controlPool } from "./db";
import { applyMigrations } from "./migrate";
import { ensureGlobalRoles } from "./roles";
import { projectMigrationsDir } from "./paths";
import { config } from "./config";
import {
  poolerEnabled,
  registerTenant,
  deregisterTenant,
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
  // Direct connection for the in-app auth framework (better-auth). A dedicated
  // role that owns its tables — isolated from the app's data role, not the
  // superuser. Session-consistent (not the transaction-mode pooler).
  authRole: string;
  authConnectionString: string;
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
  const authRole = `proj_${name}_auth`; // owns the in-app auth tables
  const externalId = name; // Supavisor tenant id

  // Reuse stored passwords if the project already exists, so re-provisioning is
  // idempotent and the tenant can be re-registered.
  const prev = await controlPool.query(
    "select db_password, auth_db_password from projects where name = $1",
    [name],
  );
  const password =
    (prev.rows[0]?.db_password as string | undefined) ??
    crypto.randomBytes(18).toString("base64url");
  const authPassword =
    (prev.rows[0]?.auth_db_password as string | undefined) ??
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

    // The auth role: a dedicated login that owns the in-app auth tables.
    const ar = await admin.query("select 1 from pg_roles where rolname = $1", [
      authRole,
    ]);
    if (!ar.rowCount) {
      await admin.query(
        `create role ${ident(authRole)} login password ${lit(authPassword)}`,
      );
    } else if (!prev.rows[0]?.auth_db_password) {
      await admin.query(`alter role ${ident(authRole)} password ${lit(authPassword)}`);
    }

    // Only this project's roles may connect to this database.
    await admin.query(`revoke connect on database ${ident(database)} from public`);
    await admin.query(
      `grant connect on database ${ident(database)} to ${ident(role)}, ${ident(authRole)}`,
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
    // Let the auth role create and own its tables in this database.
    await target.query(
      `grant usage, create on schema public to ${ident(authRole)}`,
    );
  } finally {
    await target.end();
  }

  await controlPool.query(
    `insert into projects (name, database, role, db_password, tenant_external_id, auth_db_password)
       values ($1, $2, $3, $4, $5, $6)
     on conflict (name) do update
       set db_password = excluded.db_password,
           tenant_external_id = excluded.tenant_external_id,
           auth_db_password = excluded.auth_db_password`,
    [name, database, role, password, externalId, authPassword],
  );

  // Route the project through the pooler when one is configured: the
  // authenticator in transaction mode (RLS data), the auth role in session mode
  // (the in-app auth framework). Both reach the same database.
  let pooled = false;
  let connectionString = connStr(database, role, password);
  let authConnectionString = connStr(database, authRole, authPassword);
  if (poolerEnabled()) {
    await registerTenant({
      externalId,
      database,
      users: [
        { dbUser: role, dbPassword: password, mode: "transaction" },
        { dbUser: authRole, dbPassword: authPassword, mode: "session" },
      ],
    });
    connectionString = poolerConnectionString({
      externalId,
      database,
      dbUser: role,
      dbPassword: password,
    });
    authConnectionString = poolerConnectionString({
      externalId,
      database,
      dbUser: authRole,
      dbPassword: authPassword,
      session: true,
    });
    pooled = true;
  }

  return {
    name,
    database,
    role,
    applied,
    connectionString,
    pooled,
    authRole,
    authConnectionString,
  };
}

/**
 * Tear down a project — the inverse of createProject:
 *  - deregister the Supavisor tenant (release pooler connections)
 *  - drop the database (FORCE — terminate any straggler backends; pg ≥ 13)
 *  - drop the per-project login roles (authenticator + auth owner)
 *  - delete the control-registry row
 * Idempotent: a missing tenant/db/role/row is treated as already-gone, so a
 * partially-completed earlier teardown can always be retried to completion.
 */
export async function destroyProject(
  name: string,
): Promise<{ name: string; database: string; dropped: boolean }> {
  if (!SLUG.test(name)) {
    throw new Error(
      `invalid project name '${name}' (a-z, 0-9, _, must start with a letter)`,
    );
  }

  const database = `proj_${name}`;
  const role = `proj_${name}`;
  const authRole = `proj_${name}_auth`;

  // Prefer the registered tenant id; fall back to the convention (the name).
  const reg = await controlPool.query(
    "select tenant_external_id from projects where name = $1",
    [name],
  );
  const externalId =
    (reg.rows[0]?.tenant_external_id as string | undefined) ?? name;

  // 1. Release the pooler first, so no upstream connection blocks the drop.
  if (poolerEnabled()) {
    await deregisterTenant(externalId);
  }

  const admin = adminClient();
  await admin.connect();
  try {
    // 2. Drop the database (FORCE terminates remaining backends).
    await admin.query(`drop database if exists ${ident(database)} with (force)`);
    // 3. Roles are only droppable once the database — and the objects the auth
    //    role owned inside it — is gone.
    await admin.query(`drop role if exists ${ident(authRole)}`);
    await admin.query(`drop role if exists ${ident(role)}`);
  } finally {
    await admin.end();
  }

  // 4. Forget it in the registry.
  await controlPool.query("delete from projects where name = $1", [name]);

  return { name, database, dropped: true };
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
