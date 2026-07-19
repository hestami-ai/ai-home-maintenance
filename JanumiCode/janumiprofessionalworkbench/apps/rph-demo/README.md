# RPH Demo — SvelteKit workbench

An interactive demonstration workbench for the Janumi Professional Workbench Recursive Professional Harness. It
hosts a seeded RPH engine behind SvelteKit server routes and provides PWA authoring, Undertaking/PWU inspection,
assurance, Decision, and Baseline views.

The [PWA authoring-backbone implementation note](AUTHORING-BACKBONE.md) records the app-local graph, layout,
simulation, and history boundaries. It is explicitly non-normative and does not introduce canonical Janumi
objects, Commands, Events, or runtime decisions.

## What it shows

- A PWA library and a PWA Designer for recursively composed **PWU Types**, permitted-child cardinality,
  input/output hand-offs, and assurance-policy assignments.
- A structural PWA graph rendered with [Svelte Flow](https://svelteflow.dev) (`@xyflow/svelte`) from an app-local
  `@statelyai/graph` representation and ELK layout, with an explicit Dagre fallback.
- Separate composition and data-flow lenses, graph-health feedback, collapsible subtrees, and presentation-only
  canvas controls.
- A derived, non-authoritative PWU work-lifecycle topology that can be explored locally with XState without
  dispatching a Command or persisting simulated state.
- The Reference Undertaking's Professional Work Graph and each concrete PWU Instance's independent state axes:
  work-lifecycle, execution, assurance, and shape-integrity.
- **No green without assurance** (INV-5 / Property P1): a node is green **only** when execution SUCCEEDED *and*
  assurance is SATISFIED. The Mobile/Offline concern executed successfully but is only *conditionally* satisfied,
  so it renders **amber**, not green — execution success never implies assurance.
- Command-driven PWA publication, PWU lifecycle actions, assurance-floor recording, Decisions, waivers, and
  Baselines within the demo host.

## Architecture

This is a SvelteKit client/server demo, not a pure client surface. [`src/lib/server/workbench.ts`](src/lib/server/workbench.ts)
hosts one lazily seeded, process-local RPH engine backed by in-memory SQLite. Server loads query it; form actions and
the PWA authoring broker dispatch real domain Commands; the authoring-agent endpoint streams normalized events over
SSE. The process-local store is suitable for a demonstrator and test harness, not production durability.

The browser receives page data and rebuildable projections. `@janumipwb/rph-projections` supplies graph and
assurance read models; app-local adapters turn PWA/PWU Type structure into `@statelyai/graph`, ELK/Dagre layout, and
Svelte Flow render models. Native Node dependencies such as `better-sqlite3` remain in server-only modules.

The PWA canvas shows reusable PWU Types. Concrete PWU Instance state remains on Undertaking views; it is not painted
onto Type cards. XState is used only for a derived local lifecycle simulation and is not a persistence or execution
authority. Canvas position undo/redo is likewise presentation-only.

## Run

```sh
# From the monorepo root (Bun is pinned by devEngines)
bun install
bun run --filter @janumipwb/rph-demo dev
```

Or, after the root install:

```sh
cd apps/rph-demo
bun run dev
```

Vite serves the development app at the URL it prints (normally `http://localhost:5173`). Use the app-local checks
from `apps/rph-demo`:

```sh
bun run check
bun run test
bun run e2e
```

Normal development and production use the agy Reasoning Review validator. If `JPWB_JUDGE_MODEL` is not set, the
application pins `Gemini 3.5 Flash (High)` and passes that exact label to `agy --model`. To override it, set a model
label returned by `agy models` in the same shell before starting the server, for example in PowerShell:

```powershell
$env:JPWB_JUDGE_MODEL = 'Gemini 3.1 Pro (High)'
bun run --filter @janumipwb/rph-demo dev
```

The package is a Bun workspace and participates in the monorepo's Turbo tasks through its declared scripts. npm is
not the supported package-manager path for this repository.
