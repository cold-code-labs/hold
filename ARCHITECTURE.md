# Hold — Architecture

> **Hold** is an open-source, multi-tenant Postgres BaaS: Supabase's developer experience,
> PocketBase's lightness, self-hostable on any Docker host — your own way.

## What it is

Hold is a **multi-tenant, open-source, self-hostable backend platform built on real Postgres**.

Three pieces:

1. **Control plane** — a web panel (Supabase-style) plus a **management API**.
2. **Shared data plane** — Postgres cluster(s) + Supavisor (multi-tenant pooler).
3. **Lightweight à-la-carte satellites, per project** — only what each project asks for.

The control plane is a standalone product. External systems (your own automation, provisioners,
CI) drive it through the management API to create and manage projects.

## Iron principles

1. **Heavy is shared** (multi-tenant), **light is per-project and optional**.
2. **GoTrue is the one and only auth** — every project, no exceptions (no Auth.js, no profile
   layer). Data goes through **server-side code** by default; **PostgREST is à-la-carte**, added
   only when a project wants a raw REST API exposed. **RLS always** (DB-enforced).
3. **Real Postgres underneath**; extensions (pgvector, etc.) enabled **on demand, per database**.
4. **Healthy scaling**: Supavisor kills connection blow-up + **tiering** (a project that grows
   earns a dedicated cluster) + PITR backups.
5. **Assemble OSS upstream** (Postgres, Supavisor, GoTrue, PostgREST, Garage). Hold **builds** the
   panel, the provisioner, the SDK, and the conventions. It **never rewrites** the database, the
   pooler, or the auth server.

## Topology

```
   CONTROL PLANE                          DATA PLANE (shared)
 ┌────────────────────────┐            ┌──────────────────────────────────────────┐
 │ Hold Panel             │            │  Supavisor (MULTI-TENANT pooler)            │
 │  (SQL / table / auth / │  ── API ──▶│   routes project → db, guards connections   │
 │   RLS / keys / logs /  │            │         │                                  │
 │   backups)             │◀── meta ───│  Postgres (1+ cluster, 1 DB / project)      │
 │                        │            │   ├ db_project_a  ├ db_project_b  ├ ...      │
 │ Hold API (management)  │            └──────────────────────────────────────────┘
 └───────────┬────────────┘                ▲ à-la-carte per project
             │ called by                    │  ┌ GoTrue (auth)    [ALWAYS, per project]
   external automation /                     │  └ PostgREST (RLS) [à-la-carte]
   provisioners / CI                         │     realtime = SSE in-app · storage = Garage (S3)
```

## Auth & data (final decision)

**GoTrue is Hold's one and only auth.** Every project is born with its own GoTrue (an auth schema
in its database, its own JWT secret) — auth isolated per project, the way Supabase does it. No
Auth.js, no profile layer, no choice to make.

- **Auth = GoTrue** (always, per project): signup/confirm/reset/OAuth/magic-link/MFA out of the
  box, standard JWT.
- **RLS = always** (DB-enforced security): policies read the claims from the GoTrue JWT.
- **Data = server-side code** by default; **PostgREST à-la-carte** only for a project that wants a
  raw REST API exposed.
- **Claim injection**: with PostgREST it's automatic; with server-side code the `hold.db` layer
  injects the GoTrue claim per transaction (`set_config(..., true)` — Supavisor transaction mode).

| Profile | Composition | Footprint / instance |
|---|---|---|
| **Default** | app + GoTrue + db | ~90–120 MB |
| **+ REST API** | app + GoTrue + PostgREST + db | ~120–160 MB |

## Control plane — the panel

Panel surface:

- **Projects**: create / list / status / metrics / tier
- **SQL editor**
- **Table editor** (view/edit data)
- **Auth & Users** (manage users and sessions — managed profile)
- **RLS policies** (editor + "test as user X")
- **API & Keys**: connection string (via Supavisor), anon/service keys, PostgREST URL
- **Logs** (query / auth)
- **Backups** (PITR + granular per-db restore)
- **Services** (per-project à-la-carte toggles: PostgREST, GoTrue, extensions)
- **Settings** (tier, move to a dedicated cluster)

### Hold API (management)

A REST/RPC surface the panel uses **and** that external systems call. Core:
`createProject` · `dropProject` · `runMigration` · `toggleService` · `setProfile` ·
`createApiKey` · `getConnectionString` · `listUsers` (managed) · `backup` / `restore`.

## Data plane

- **Postgres**: runs **inside the box** as a container in the Hold stack (a Compose / Coolify
  service), **not** a host install → the whole of Hold boots on **any Docker host**
  (portability > a dedicated box). 1+ clusters, **one database per project** (logical isolation),
  extensions per db. Accepted trade: projects share the box's resources and fault domain; the
  release valve is tiering onto a dedicated cluster later.
- **Schema & migrations**: **SQL-first** (versioned `.sql` files, applied by Hold's runner) as the
  canonical contract — like Supabase, because RLS/policies/functions/triggers are SQL and an ORM
  gets in the way. **Drizzle** is the typed data layer in the SDK/apps (queries + types).
  **Not Prisma** (friction with RLS / the pooler).
- **Supavisor**: multi-tenant pooler; routes project → db; solves connection blow-up.
  ⚠️ transaction mode → RLS via `set_config('request.jwt.claims', …, true)` **per transaction**
  (LOCAL).
- **Tiering**: a project starts on the shared cluster; when it grows or becomes critical it moves
  to a **dedicated cluster** (Supavisor re-points; the app doesn't change). A valve for
  noisy-neighbor and fault isolation.
- **Backups**: WAL-G / pgBackRest on the cluster (PITR) + per-db `pg_dump` (granular restore).

## Storage (blobs / files)

**Garage** (Rust, S3-compatible) is the object store: **self-hosted, in the shared core** — a
single store, **one bucket per project**. No provider lock-in.

- `hold.files` speaks **standard S3** (presigned URLs) → the backend is fully pluggable (Garage
  today; R2 / SeaweedFS are drop-in if ever needed).
- **File metadata** lives in a table in the project's db, with **RLS** (mirrors Supabase's
  `storage-api` model, without running a Node process per project).
- ⚠️ **Durability is now yours.** Plan:
  - **multi-node Garage replication** once there's a second box (native), and/or
  - **async backup** of the bucket to cold off-site storage, and/or volume snapshots.
- Image transforms / resumable uploads (TUS): kept thin in the SDK for now; reuse the upstream
  `storage-api` only if it becomes a real need.

## SDK — `@hold/client`

The cohesion layer that makes Hold feel "PocketBase-like". It hides the decomposition:

```
hold.auth   → GoTrue (lifecycle / OAuth / magic-link / MFA)
hold.db     → Drizzle via Supavisor (typed; injects the RLS claim)
hold.files  → upload / signed-url on Garage (standard S3)
hold.live   → SSE over LISTEN/NOTIFY
```

App code calls `hold.auth.login()` / `hold.db.query()` — it never touches Supavisor or GoTrue by
hand.

## Panel stack

- **Next.js** (dogfooded — the Hold Panel can run on Hold itself). Deployed on any Docker/Coolify
  host.
- **Hold API**: route handlers / a small Node service → talks to Postgres admin + Supavisor admin
  + the deploy target's API (to bring up GoTrue / PostgREST).

## Bootstrap & dogfood (project zero)

**Dogfood: yes — the Hold Panel runs as a Hold app** (it uses Hold's own Postgres / GoTrue / SDK →
real dogfooding + a reference implementation for anyone self-hosting).

The circular dependency is resolved with **"project zero"**: the Panel's own project (db + an
**admin** GoTrue) is created by the **installer at bootstrap**, not through the UI. From there the
Panel comes up authenticated against project zero's GoTrue, and operators create tenant projects
normally. (Same pattern as Supabase Studio.)

- **The Panel's own auth = project zero**: its own db + GoTrue, at bootstrap. There is no "special"
  platform auth — it's just project 0. Isolated from tenants by construction (own db / JWT secret).
- **Hold API auth**: an admin JWT (project zero's GoTrue) for the Panel + **service tokens** for
  machine callers (automation, provisioners).
- The installer brings up: Postgres + Supavisor + Garage + **project zero** → the Panel
  authenticates → operators create tenants.

## Open-source

- **Public from the start** — developed in the open.
- **License: Apache-2.0** — permissive (adoption + corporate trust) and with a **patent grant**
  (which MIT lacks); the same license Supabase uses.
- **In the OSS repo**: the panel, the provisioner, the SDK, and the stack's deploy recipe
  (Compose / Coolify). Public docs in **English**.
- **Naming**: upstream keeps its names (Postgres / Supavisor / GoTrue / PostgREST / Garage);
  components built for Hold get Hold's own names.

## Scale & guardrails

- Supavisor → connections under control.
- Tiering → noisy-neighbor / fault isolation on demand.
- **Honest fault domain**: the shared cluster is a shared blast radius; critical projects go to a
  dedicated tier.
- Observability: Postgres metrics + host metrics; the panel shows them per project.

## Roadmap

| Phase | Delivery |
|---|---|
| **P0** | Postgres + Supavisor on the shared box; multi-tenant pooling proven with 2 dbs |
| **P1** | Minimal Hold API (`createProject` = CREATE DATABASE + role + Supavisor + migrations + **bring up the project's GoTrue** + JWT secret) + connection string + auth ready |
| **P2** | Hold Panel v1 (projects, SQL editor, table editor, Auth & Users from GoTrue, connection/keys) |
| **P3** | RLS editor + **PostgREST à-la-carte** (toggle, for projects that want a raw REST API) |
| **P4** | Backups/PITR, multi-cluster tiering, logs, metrics, OSS polish (EN docs, license, deploy recipe) |

## Decisions

- [x] **Auth** → GoTrue, single and definitive (Auth.js removed)
- [x] **Storage** → Garage (self-hosted S3, one bucket per project)
- [x] **License** → Apache-2.0; public repo from the start
- [x] **Dogfood** → yes, with a bootstrap "project zero"
- [x] **Postgres: where/how** → in-box (stack container, portable)
- [x] **Migrations** → SQL-first (Supabase-style) + typed Drizzle (not Prisma)
- [x] **Panel / API auth** → project zero + service tokens
- [x] **Naming** → upstream keeps its names; Hold components get Hold names
- [ ] **Storage advanced**: thin transforms/TUS in the SDK vs. reusing `storage-api` (P3+)
- [ ] Register **RustFS** as an alternative "on the radar"

> Foundational decisions are **closed**. Next concrete step: spec the **Hold API** contract
> (`createProject`) + the **bootstrap Compose** (Postgres + Supavisor + Garage + project zero).
