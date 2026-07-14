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

The judge role has been promoted into the product itself (`AUTHORING_ASSESSMENT` domain object + the bounded
assess → auto-refine → escalate loop in the authoring SSE route). The **same role, two implementations**:

- **Product runtime** — the `agy` (Google Antigravity / Gemini) assessor, a DIFFERENT vendor than the Pi/Codex
  authoring executor (exec ≠ assurance; the judging vendor/model is recorded on the assessment's `assessor`).
  It scores each authoring turn; a non-faithful result auto-refines once, then escalates to the human.
- **Harness oracle** — this Claude judge panel stays the out-of-band, higher-power reviewer that grades the
  product's own judge. The virtuous cycle is: the harness (Claude) validates that the in-product judge (agy)
  is any good.

Under E2E (`RPH_DEMO_MODE=test`) the in-product assessor is the deterministic **mock** (structural-only), so
`e2e/faithfulness-assessment.e2e.ts` exercises the whole loop reproducibly in the gate.

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
