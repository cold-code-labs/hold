# Security Policy

Hold is early / WIP software. It is **not yet hardened for production** — run it accordingly.

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report privately through GitHub's
[private vulnerability reporting](https://github.com/cold-code-labs/hold/security/advisories/new)
(Security → Advisories → "Report a vulnerability" on this repository).

Include, where possible:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- affected version / commit.

We aim to acknowledge reports within a few business days and will coordinate a fix and disclosure
timeline with you.

## Scope notes

- **Auth & RLS**: every project uses GoTrue with Postgres Row-Level Security. Issues that let one
  project read or write another project's data, or that bypass RLS, are the highest priority.
- **Secrets**: per-project credentials (database roles, JWT secrets) are generated at provisioning
  time and must never be committed. If you find a secret in the repository or its history, report
  it privately as above.
