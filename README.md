# Hold

> Open-source, multi-tenant **Postgres** BaaS. Supabase's DX, PocketBase's lightness — your own way.

**Status: early / WIP.** Built in the open, slice by slice.

Hold is a self-hostable backend platform: a shared Postgres core (one database per project),
per-project lightweight services only when needed, a cohesive client SDK, and a control panel —
packaged so the whole thing boots on any Docker / Coolify host.

- **Data** — Postgres, one database per project, pooled by Supavisor.
- **Auth** — GoTrue per project, with Postgres Row-Level Security.
- **Storage** — Garage (self-hosted, S3-compatible).
- **Realtime** — Postgres `LISTEN/NOTIFY` + SSE.
- **API** — server-side by default; PostgREST à-la-carte.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full design.

## Quickstart (standalone dev)

Requirements: Docker, Node 20+, pnpm.

```bash
cp .env.example .env

# 1. bring up the shared core (Postgres)
docker compose up -d db

# 2. install + bootstrap the control plane (creates the `hold` control db)
cd control-plane
pnpm install
pnpm bootstrap

# 3. create your first project (db + base schema + RLS)
pnpm cli create demo

# 4. or run the control-plane API
pnpm start            # POST /v1/projects {"name":"demo"}
```

`create` provisions a dedicated `proj_<name>` database with the base schema
(RLS-enabled `todos` example) and returns its connection string.

## Roadmap

- [x] Shared core: Postgres + project provisioning (`createProject`)
- [ ] Supavisor (multi-tenant pooling)
- [ ] GoTrue per project + RLS wiring
- [ ] Garage (S3 storage)
- [ ] Control panel (projects, SQL editor, table editor, auth & users)
- [ ] PostgREST à-la-carte
- [ ] Package: one-command compose / Coolify recipe

## License

[Apache-2.0](LICENSE).
