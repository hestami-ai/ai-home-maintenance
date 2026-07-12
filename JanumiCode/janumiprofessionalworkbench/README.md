# Janumi Professional Workbench (JPW)

The **Recursive Professional Harness (RPH) engine** — a deterministic, event-sourced, host-agnostic
TypeScript core library over `better-sqlite3`. It represents professional undertakings as a graph of
persistent Professional Work Objects and enforces the separation of Shape / Execution / Assurance /
Governance / Baseline (the canonical rule: `executionState = SUCCEEDED` never implies
`assuranceState = SATISFIED`).

- **Specs (authoritative):** `docs/Recursive Professional Harness/` (RPH-DOC-001..009).
- **Roadmap & tracker:** `docs/JPW Implementation Roadmap and Tracker.md`.
- **Build working docs:** `docs/_working/` (RESUME-STATE, OPEN-QUESTIONS).

This workspace is incubated here and will later port into `janumi/products/janumipwb/` (platform milestone
MP). Packages are scoped `@janumipwb/rph-*`.

## Layout

```
packages/
  typescript-config   shared tsconfig base
  rph-contracts       Zod schema source -> TS types + JSON Schema (envelope, ids, enums, errors, DSL)
  rph-ports           host-injectable interfaces (StorageAdapter, Logger, IdentityProvider, ...)
  ...                 (further engine packages added per milestone; see tracker §4)
```

## Commands

```
bun install
bun run build         # turbo: compile all packages
bun run check-types   # turbo: tsc --noEmit
bun run lint          # turbo: eslint
bun run test          # turbo: vitest
bun run boundary      # dependency-cruiser: enforce the package DAG + no-UI-in-core
bun run format        # prettier (TS only; never the spec docs)
```

Licensed **AGPL-3.0-only** (community engine core).
