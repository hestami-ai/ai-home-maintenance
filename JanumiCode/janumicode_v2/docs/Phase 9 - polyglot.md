# Phase 9 Genericity + Closing-Act Redesign (post-slice-145)

## Context

Slice-145 e2e-validated the interactive-executor stack (composition root, scoped
gates, constitution side-channel, deferred-wave rescues): 28/29 leaves passed and
a real runnable app entrypoint was produced for the first time. Verification (ours
+ an independent agent, cross-checked line-by-line) surfaced both genuine bugs and
a deeper architectural limit: **the entire deterministic Phase-9 layer assumes one
TypeScript/Node `ProjectProfile` for the whole workspace**, and the user's stated
tech-stack intent — though captured in Phase 1.0c as `TECH-*` constraints — never
reaches it (the ADR schema has no `project_profile`/`tech_stack` field; the
hardcoded `typescript/esm/vitest` default silently wins). A user who says "build
this in Django," or a brownfield Spring/Java repo, would be mis-scaffolded as
greenfield TypeScript.

A long design discussion converged on **deferring stack / polyglot / brownfield
reconciliation to Phase 9 agents** rather than building a 3-phase upstream program
(Phase-0 inventory + Phase-4 domain→location join + per-subsystem schema). This is
the project's native principle: filesystem truth exists only in Phase 9; the
executor's job is research → plan → implement against reality. Verified facts that
shape this: Phases 1–8 and DMR do **not** read the filesystem (only Phase 0 scans,
and only to ingest a capped, language-signal-discarding sample); `leafTestRunner`
already has `pytest`/`cargo`/`go test` branches; `fileClassifier` already knows
Cargo/go/pyproject/pom.

## Converged architecture decisions

- **Stack/integration is judgment, not computation** — must not be derived
  deterministically in Phase 9. (User correction.)
- **Upstream stays advisory + structurally unchanged.** Stated stack = advisory
  `TECH-*` constraint, already captured and already flowing into Phase 9 context.
  No new upstream schema/phases.
- **Coordination must survive deferral.** The deterministic kernel was the fix for
  slice-127/139 fragmentation. Deferral must NOT become "30 leaf agents each guess
  the stack/layout independently."
- **Resolution: one Phase-9.0 reconnaissance agent establishes ground truth once;
  everything downstream consumes it.** Recon researches the workspace + advisory
  intent → ground-truth artifact: per-area stack(s), domain→existing-location
  bindings, layout/dependency plan, integration boundary.
- **Authorship = Replace (user decision).** Agents author all scaffolding per the
  recon plan; the kernel (`scaffoldSynthesis` materializer, `moduleOwnershipPlanner`,
  `layoutContract`) stops authoring and becomes **pure enforcement** (single owner
  per shared module, write-scope/protected-paths guard, per-area
  divergence/layout-violation detection). Polyglot (Q2-b) then falls out: the agent
  scaffolds each area in its own stack; the kernel enforces per-area invariants.

## Plan (staged)

### Stage 0 — Correctness fixes (executable now, independent of the redesign)

1. **Honest Phase-9 gate.** `phase9.ts` (~L642) writes
   `has_unresolved_warnings:false, has_high_severity_flaws:false` as constants.
   Derive from `scheduleResult` (terminallyDeferred>0, rejectedWaves>0,
   quarantined>0) + global test/eval results.
2. **Test-file→leaf attribution.** `leafTestRunner` scopes to the write dir, but a
   sibling's broken test still burns this leaf's budget. Use the wave-snapshot diffs
   already captured (`workspaceSnapshot.ts` `captureWaveSnapshot`/`diffWaveSnapshots`)
   to gate only on the leaf's OWN test files; surface sibling/pre-existing failures
   as advisory, not a verdict against this leaf.
3. **(Interim, low-cost)** nullable model rendering (`renderEntityModule` must read
   `constraints` for nullable/optional → `T | null`); module ownership using the
   *resolved* scaffold `shared_dir` not the config default. These live in code the
   redesign eventually retires; include only because the TS path uses them until then.

### Stage 1+2 — Agentic Phase-9 redesign (the program; needs a focused design pass)

Treated as ONE coherent redesign so the closing act isn't built single-stack then
reworked per-area:

- **9.0 Reconnaissance sub-phase (NEW, agentic).** Coding agent (filesystem access)
  researches the repo + advisory intent → `phase9_ground_truth` artifact: per-area
  stack, domain→location bindings, layout + dependency plan, integration boundary.
  Sits at 9.0 alongside today's scaffold/ownership slots.
- **Kernel → pure enforcement.** Retire deterministic authoring in
  `scaffoldSynthesis`; repurpose `moduleOwnershipPlanner` directives to
  advisory+enforced; make `layoutContract` per-area + recon-derived. Keep
  `detectLayoutViolations`, the protected-paths/write-scope guard, and ownership
  checks as the enforcement surface (now per-area, language-agnostic).
- **Per-area gates.** `leafTestRunner` + the typecheck gate resolve commands per-area
  from the recon plan (the `framework_autodetect` branches already exist for tests).
- **Agentic closing act (folds in composition-root + stabilization).** Move the
  composition root out of the backlog wave; after the deferred wave, run a
  **stabilization loop**: run the per-area global gates → on red, launch a
  repair-mandated agent session with full failure evidence → re-run → bounded budget
  → record honest residuals. Composition root = wiring step; stabilization =
  debugging step; both per-area + integration-boundary aware.

## Critical files

- Stage 0: `src/lib/orchestrator/phases/phase9.ts` (gate); `src/lib/orchestrator/leafTestRunner.ts` + `src/lib/orchestrator/workspaceSnapshot.ts` (attribution); `src/lib/orchestrator/phases/scaffoldSynthesis.ts` (`renderEntityModule`).
- Redesign: NEW `src/lib/orchestrator/phases/phase9Recon.ts` (+ ground-truth schema/record type); `scaffoldSynthesis.ts`, `moduleOwnershipPlanner.ts`, `layoutContract.ts` (author→enforce); `executionScheduler.ts` (per-area gates, stabilization wave, composition-root sequencing); `compositionRoot.ts`.

## Verification

- Stage 0: unit tests per fix; rerun a resume-DB Phase 9 and confirm the gate record
  reflects real residuals and that a leaf is not failed by a sibling's broken test.
- Redesign: a fresh greenfield-TS slice must still produce a runnable app (no
  regression); then a Python-intent slice and a brownfield slice exercise per-area
  scaffolding + enforcement + per-area gates end-to-end.

## Sequencing note

Stage 0 is cheap, no-rework, and improves the validated path immediately. The
redesign (Stages 1+2) is the larger program the discussion was about; because it
reshapes the closing act, building a single-stack stabilization wave first would be
partial rework — so the closing act is folded into the redesign rather than done
separately. Recommended order: Stage 0 now → focused design+build pass for the
agentic redesign next.
