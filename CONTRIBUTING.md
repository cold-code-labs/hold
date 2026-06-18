# Contributing to Hold

Thanks for your interest in Hold. The project is **early / WIP** and built in the open, slice by
slice — expect things to move and break.

## Ground rules

- Be respectful. See the [Code of Conduct](CODE_OF_CONDUCT.md).
- Keep changes focused. One concern per pull request.
- Discuss anything large in an issue first, before writing the code.

## Project layout

```
control-plane/   TypeScript management core (Hono + pg) — project provisioning, Hold API
panel/           Next.js control panel
migrations/      SQL-first project migrations (the canonical schema contract)
control/         SQL for the control database
docker-compose*  the shared core (Postgres) and the production stack
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design and the principles behind it.

## Local development

Requirements: Docker, Node 20+, pnpm.

```bash
cp .env.example .env

# shared core
docker compose up -d db

# control plane
cd control-plane
pnpm install
pnpm bootstrap          # creates the `hold` control db
pnpm cli create demo    # provisions proj_demo (db + base schema + RLS)
pnpm start              # POST /v1/projects {"name":"demo"}
```

## Before opening a pull request

- `control-plane`: `pnpm exec tsc --noEmit` passes.
- `panel`: `pnpm build` passes.
- Schema changes go through a **versioned `.sql` migration** — never ad-hoc DDL. RLS is part of the
  migration, not an afterthought.
- Don't commit secrets. `.env` is gitignored; only `.env.example` (placeholders) is tracked.

## Commit messages

Short, imperative, scoped: `feat: …`, `fix: …`, `docs: …`, `chore: …`.

## License

By contributing you agree your contributions are licensed under [Apache-2.0](LICENSE).
