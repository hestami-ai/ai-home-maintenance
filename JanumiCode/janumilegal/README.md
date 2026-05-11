# JanumiLegal

Lens-driven legal AI production harness — VS Code extension + Svelte webview + better-sqlite3 sidecar.

## Status

**Wave 0 — Foundations and Boundaries.** This is the platform skeleton. No legal content yet. Per [docs/janumilegal_implementation_roadmap.md](docs/janumilegal_implementation_roadmap.md).

## Documents

- [Product description](docs/janumilegal_product_description.md) — source doctrine.
- [Evolution addendum](docs/janumilegal_product_description_evolution.md) — architectural gaps and resolutions.
- [Multi-matter isolation addendum](docs/janumilegal_multi_matter_isolation_addendum.md) — multi-tenancy design.
- [Implementation roadmap](docs/janumilegal_implementation_roadmap.md) — wave-by-wave checklist.
- [Privilege design (engineering draft)](docs/design/governed_stream_privilege.md).
- [Canonical Legal Vocabulary v1](docs/clv/canonical_vocabulary_v1.md).
- [Gold capture protocol](docs/calibration/gold_capture_protocol.md).
- [Initial client profile](docs/janumilegal%20-%20initial%20client%20profile.md) — JC Law (design partner).

## Build

```sh
pnpm install
pnpm build      # typecheck + esbuild all four bundles (extension, sidecar, rpcWorker, webview)
pnpm test       # vitest
pnpm lint       # eslint
pnpm lint:layers  # layer-boundary + DAL-bypass linter (CI-blocking)
pnpm ci         # full local CI run
```

## Architecture

### Three layers

```
src/layer1_core/        — platform; may not import layer 2 or 3
src/layer2_lens_packs/  — practice-area lens packs; may not import layer 3
src/layer3_firm_config/ — firm-specific configuration
src/lib/                — cross-cutting platform infrastructure (layer-1 by import rule)
```

### Bundles produced by `node esbuild.js`

```
dist/extension.js         — Extension host (CommonJS, Node 22)
dist/sidecar/dbServer.js  — Database sidecar process (Node 22)
dist/rpcWorker.js         — RPC worker bridge (Node 22, worker_threads)
dist/webview/main.js      — Webview client (browser IIFE, Svelte)
```

### Standing disciplines (CI-enforced)

- No `import 'better-sqlite3'` outside `src/lib/database/` (R3).
- No raw `db.prepare`, `db.exec`, `db.transaction`, or `new Database(...)` outside `src/lib/database/` (R4).
- No layer 1 import from layer 2 or 3 (R1).
- No layer 2 import from layer 3 (R2).
- Two-matter isolation test (`src/test/isolation.test.ts`) is the binding architectural test.

See `scripts/lintLayers.ts` for the linter implementation.
