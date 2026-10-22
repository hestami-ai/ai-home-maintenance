# Virtuous-cycle validation harness

How the harness operator validates that a PWA the coding agent generated is a **correct and faithful**
interpretation of its prompt — without eyeballing a screenshot, and against the event-sourced engine truth
(not the Svelte-Flow render model).

## Layer A — structural validity (deterministic, in-gate)

`@janumipwb/rph-projections` → `buildPwaGraphExport(pwa, nodes)` produces the **canonical export**
(`{ pwa, nodes, permits, dataFlow, artifacts, roots }`) and `analyzePwaGraph(export)` produces a
**report** with hard invariants (`single-root`, `acyclic-permits`, `connected`) that drive `valid`, plus
advisory findings (dangling data-flow, fan-out/star, unused outputs, duplicates) and metrics.

- The E2E harness helper `e2e/support/gallery.ts → snapshotPwaGraph(request, label)` writes
  `graph.export.json` + `graph.report.json` into `e2e-results/gallery/<test>/` and returns the report.
- Tests assert `report.valid` (the real "is this a well-formed PWA?" gate) — see `e2e/graph-validation.e2e.ts`
  and the live run `e2e-live/sdlc-pwa.live.ts`.
- The designer surfaces the same report as a "graph health" chip.

## Layer B — faithfulness to the prompt (semantic, on-demand)

`pwa-judge-panel.workflow.js` — a **Claude multi-lens judge panel** (V-model / UCD / JTBD / holistic
architect) that reads the export + the agent's own recorded plan and scores coverage + coherence, then a
synthesizer produces a consensus verdict `{ verdict, meanScores, topGaps, recommendation }`. This answers
the semantic question the invariants cannot (e.g. "is the V-model actually realized, or just name-checked?").

### Layer B is now also an IN-PRODUCT capability (assurance-over-authoring)

The judge role has been promoted into the product itself. After an authoring turn's agent run, the authoring SSE
route (`src/routes/pwa/[id]/agent/+server.ts`) runs the de minimis assurance floor over the staged candidate, and its
mandatory **Reasoning Review** judges the candidate against the policy's criteria. Two turns get no floor: one whose
agent run throws, and one whose producing model never resolved (so the reviewer's independence cannot be
established). Either way the candidate cannot be committed, since only a satisfied floor makes it ready to commit.
With the live Pi agent, valid subject findings drive one auto-refinement pass and a re-review. A candidate that still fails stays staged: marked
revision-required, or blocked when the fault is the review's own (the reviewer failed, was not independent of the
producer, or escalated). The canonical DRAFT is unchanged either way. The outcome is
recorded as `ASSURANCE_ASSESSMENT` and `ASSURANCE_OBSERVATION` objects, with the reviewer's identity as the
assessment's `evaluator`. (The earlier `AUTHORING_ASSESSMENT` object and its faithfulness commands were retired in
favour of this floor.) The **same role, two implementations**:

- **Product runtime** — the reviewer that `src/lib/server/assurance/reviewer-selection.ts` selects. Outside test mode
  it is configuration: the sponsor's selection (`REG-D-119`) is devin with `glm-5-3-flash-high`, and agy with
  `JPWB_JUDGE_MODEL` stays configurable. Its independence from the authoring agent (exec ≠ assurance) is checked on
  the recorded model ids, never assumed from a vendor. Setup and preconditions are in the app README's
  [reasoning reviewer](../README.md#the-reasoning-reviewer) section.
- **Harness oracle** — this Claude judge panel stays the out-of-band, higher-power reviewer that grades the
  product's own judge. The virtuous cycle is: the harness (Claude) validates that the in-product reviewer is any
  good. Measuring a reviewer against a fixed case set is a separate instrument: the reviewer-qualification harness
  (`scripts/reviewer-qual/` at the monorepo root), whose record `bun run reviewer:qual:check` holds to today's
  reviewer.

Under E2E (`RPH_DEMO_MODE=test`) with no `JPWB_ASSURANCE_TOOL` — which the gate's e2e server has removed — the
in-product reviewer is the declared **stand-in** (`src/lib/server/assurance/standin-reasoning-review-validator.ts`):
the structural checker's real judgements, plus the remainder a test stipulates, recorded as not judged.
`e2e/assurance-floor.e2e.ts` exercises the loop reproducibly in the gate. ⚠ `e2e:live` also boots in test mode, but
its server inherits the shell: with `JPWB_ASSURANCE_TOOL` exported, the selector takes that tool, not the stand-in, so
the real reviewer runs, or the turn is refused when the tool or its model is wrong.

## Running the whole loop

```
# 1. Generate with the REAL agent + capture artifacts (screenshots, export.json, report.json, engine-truth).
bun run --filter @janumipwb/rph-demo e2e:live       # (from repo root; or `bun run e2e:live` in apps/rph-demo)
open apps/rph-demo/e2e-results/gallery/index.html    # review gallery

# 2. Judge faithfulness (Claude judge panel) over the captured export + the agent's plan.
#    Invoke the Workflow tool with:
#      scriptPath: apps/rph-demo/harness/pwa-judge-panel.workflow.js
#      args: { exportPath, truthPath, prompt }   (paths point into the gallery dir from step 1)
```

An example consensus for the SDLC prompt is captured at
`e2e-results/gallery/<test>/judge-verdict.json` (gitignored — regenerate per run).
