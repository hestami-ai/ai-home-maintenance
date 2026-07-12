# RPH Demo (M14) — SvelteKit + Svelte Flow

A demonstration UI for the Janumi Professional Workbench Recursive Professional Harness. It visualizes the
**Reference Undertaking** (a multi-tenant field-service SaaS) as a graph of Professional Work Units and makes the
model's load-bearing invariants **visible**.

## What it shows

- The PWU **decomposition graph** (root Product Realization → Intent / Behavior / Architecture → 5 architecture
  concerns), rendered with [Svelte Flow](https://svelteflow.dev) (`@xyflow/svelte`).
- Each node's **four independent state axes** — work-lifecycle, execution, assurance, shape-integrity.
- **No green without assurance** (INV-5 / Property P1): a node is green **only** when execution SUCCEEDED *and*
  assurance is SATISFIED. The Mobile/Offline concern executed successfully but is only *conditionally* satisfied,
  so it renders **amber**, not green — execution success never implies assurance.
- The **authoritative baseline** (the Architecture PWU) with a heavy indigo border, and the **open offline
  residual** that must stay visible (RPH-FIX-006).

## Architecture

This app is a pure **client surface**. It consumes ONLY the pure `@janumipwb/rph-projections` read-model seam
(`buildReferenceUndertakingGraph()` from the tested graph-view projection) via
[`src/lib/toFlow.ts`](src/lib/toFlow.ts) — the engine never renders, and the UI never reaches into the domain.
Consuming the pure projections seam (not the Node `rph-engine` facade) keeps the browser bundle free of
`better-sqlite3` / `node:crypto`. The graph data + the no-green rule are unit-tested in
`packages/rph-projections/src/graph-view.test.ts`.

## Run

```sh
npm install     # (from this directory) installs SvelteKit + @xyflow/svelte
npm run dev      # http://localhost:5173
```

> The rph-projections package is a workspace dependency; from the monorepo root a `bun install` links it. This app is
> intentionally NOT wired into the root test/lint/boundary gate (it is a demonstration surface, not engine logic).
