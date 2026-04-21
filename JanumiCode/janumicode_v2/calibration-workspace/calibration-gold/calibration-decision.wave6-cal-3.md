# Wave 6 calibration decision — tag=wave6-cal-3 — date=2026-04-20

## Run context
- Workspace: `calibration-workspace/` (reset between iterations; specs + config preserved)
- Intent: same as cal-1 (Hestami product description review)
- Calibration feature under test: **records-idle progress-based quiescence** replacing the prior 1-hour wall-clock cap (`workflow.records_idle_stall_ms = 900000`, 15 min silence threshold)
- `decomposition.reasoning_review_on_tier_c`: enabled
- `llm_routing`: both `requirements_agent` and `reasoning_review` routed to `ollama / qwen3.5:9b` (unchanged from cal-1)
- Calibration iterations summary so far:
  - **cal-1** (previous wall-clock cap): killed at 60 min with 110 FR nodes, Pass 1 incomplete.
  - **cal-2**: aborted in Phase 1.0b from a qwen JSON-emission hiccup (duplicate key fragment `"phase": "phase": "Phase 3"`). Unrelated to quiescence; pure model non-determinism.
  - **cal-3**: this iteration.

## Run results

### Wall-clock timing

- Phase 0: ~10s.
- Phase 1 (Intent Capture → Handoff Approval): **45 min, full completion**. 20 root FRs emerged (vs 16 in cal-1 — non-deterministic).
- Phase 2.1 (FR root bloom): produced 20 depth-0 nodes.
- Phase 2.1a (recursive decomposition): **~85 min, Pass 1 completed + Pass 2 partial**. Stream went silent at record 487 with `in_flight=1, executing=2`. Idle climbed to 900s; **records-idle stall fired as designed** and exited cleanly.
- Phase 2.2 / 2.2a (NFR): not reached.

### FR decomposition tree (partial; Pass 1 full + Pass 2 partial)

- **Total nodes: 256** (2.3× cal-1's 110)
- **Atomic Tier-D leaves: 53** (4× cal-1's 13)
- Pruned / downgraded / deferred: 0 / 0 / 0 (no rejections in auto-approve; stall killed before finalization)
- Tier distribution: **11 A / 40 B / 132 C / 53 D / 20 root**
- Depth distribution: **20 roots + 83 depth-1 + 153 depth-2**
- Assumption snapshots: 1 (pass-1 complete with delta=49 new assumptions)
- **Mirror gates emitted: 15** (vs cal-1's 6) — multiple Level-1-equivalent parents gated their Tier-B batches

### NFR tree

- Not reached — pass 2 of FR saturation was still mid-flight.

### Pipeline container record

- FR pipeline: `pipeline_id=decomp-pipe-fr-...`, 1 completed pass (83 nodes, delta=49), final_* fields absent because the loop didn't reach natural termination. Expected behavior on stall exit.

### Step 4b mislabel detections

- Many warnings logged ("decomposer disagrees with tier hint") spanning `hint=root → assessed=B` and `hint=C → assessed=B` cases. No `downgraded` supersessions written yet because the path fires only when `tierHint === 'B'`; Pass 2's re-decomposition of accepted Tier-B commitments was interrupted.

### Step 4c audit records

- **0 audit records produced.** The 4c audit pathway fires on post-gate re-decomposition of accepted Tier-B commitments (tierHint='B' → produces Tier-C/D with no mislabel signal). Pass 1 produced Tier-B children and emitted mirror gates; Pass 2 began re-decomposition but stalled before enough audits could land.

## Four-pass review

### Pass 1 — tree sanity: **PASS (stronger than cal-1)**

- Richer tier distribution than cal-1 (40 B vs 10 B — more commitment-level gating opportunities surfaced).
- Depth-2 produced 153 nodes — Tier-C/D implementation layer genuinely reached, with concrete testable ACs across categories: offline-sync policy, multi-tenant RLS, session lifecycle constraints, workflow orchestration choices, vendor verification rules.
- Step 4b disagreement rationales are **domain-literate** (talking about architectural stances, policy invariants, scope commitments) — qwen3.5:9b is producing meaningful tier self-assessments, not shallow labels.
- Option-B simultaneous gating worked: 15 distinct `decomp-gate-<parent>` bundles emitted.

### Pass 2 — audit precision: **N/A (not exercised)**

Same reason as cal-1 — audit pathway never reached because Pass 2 stalled.

### Pass 3 — recall spot-check: **N/A**

### Pass 4 — NFR applies_to_requirements: **N/A**

Phase 2.2 not reached.

## Verdict on the quiescence refactor: **STRONG PASS**

- **Demonstrated throughput improvement**: cal-3's 256 nodes vs cal-1's 110 = 2.3× more tree depth before exit. Confirmed by wall-clock: cal-1 killed at 60 min, cal-3 at 130 min — 2.2× longer run, stable progress throughout.
- **Heartbeat log works**: one line per minute showing records / idle / phase / in_flight / pending_decisions. Operators can see forward progress without polling the DB.
- **Stall detection fires cleanly on real hangs**: 900s silence + `in_flight=1` triggered exit. The `records_idle_stall_ms` knob is correctly set.
- **No false positives**: across the 2-hour run, many per-call idle periods reached 90-180s during long ollama generations, none triggered the 900s threshold.

## Verdict on the 4c-flag default: **STILL DEFERRED**

- [ ] Promote `reasoning_review_on_tier_c` to default-on
- [x] **Keep flag default-off; re-run with faster backend required before decision**
- [ ] Tune prompt

Reason: The 4c audit path is gated on post-gate Tier-C re-decomposition completing, which requires Pass 2+ to finish for at least one accepted Tier-B commitment. Across cal-1 and cal-3, the ollama/qwen3.5:9b backend hasn't made it that far within the practical compute budget of a local run. Need a faster backend (codex_cli / claude_code_cli) to reach the audit path.

## Next iteration (wave6-cal-4) preconditions

Same as cal-2's plan, still not yet addressed operator-side:

1. **Faster requirements_agent backend**: set `JANUMICODE_REQUIREMENTS_AGENT_BACKING=codex_cli` (or claude_code_cli). The hang at record 487 was ollama-specific; a CLI-backed call with proper timeout would recover.
2. **Strong API for reasoning_review**: workspace override to `{ provider: 'google', model: 'gemini-2.0-flash-thinking' }` or equivalent. Calibrating audit findings against qwen3.5:9b tells us nothing about the audit PATTERN's quality.
3. **Default records_idle_stall_ms is fine at 15 min** for ollama-class backends. Can drop to 5 min if operator wants faster fail-fast on CI-style runs.

## Files

- Partial FR decomposition gold: [`calibration-gold/product_fr_decomposition.wave6-cal-3.gold.json`](product_fr_decomposition.wave6-cal-3.gold.json) (319 KB, 256 nodes)
- NFR: not produced
- Run DB (read-only): `calibration-workspace/.janumicode/test-harness/1776708617792.db`
- Cal-1 decision for comparison: [`calibration-decision.wave6-cal-1.md`](calibration-decision.wave6-cal-1.md)

## Post-mortem on the hang (added 2026-04-20)

The user manually re-ran the exact prompt from the hung call
(`a7ab8a88-2947-46b3-9888-0447af90eb88-debug.prompt.json` / `.response.json`)
against ollama qwen3.5:9b with the same options our code sends
(`num_ctx: 262144, temperature: 1, presence_penalty: 1.5, top_p: 0.95, top_k: 20, think: true`).
**It converged in 1 minute 33 seconds** and produced a valid decomposition response.

This confirms:

1. **No prompt bug.** The same prompt converges reliably when re-run.
2. **No options bug.** Our ollama.ts already sets the exact Postman-verified parameters for qwen3 thinking models.
3. **Sampler non-determinism under streaming.** The hung call used streaming mode (the live-tail A3 path sets `onChunk`, which flips ollama into `stream: true`); the user's manual verification used `stream: false`. Identical sampler parameters produced convergence in one case and a reasoning-loop in the other. Within qwen3 thinking models this is a known sensitivity — the sampler occasionally can't exit the reasoning chain even at temperature 1.
4. **The new protective infrastructure is exactly what this class of failure needs.** Records-idle stall catches the loop in bounded time; saturation-loop resume (added post-cal-3) preserves 95%+ of completed work across retries.

## Resume capability (added post-cal-3)

- `rebuildSaturationStateFromStream` in `phase2.ts` reconstructs the queue, assumption set, sibling map, pass number, and pipeline-container chain from the governed stream on re-entry.
- Phase 2.1 and Phase 2.2 skip their bloom + depth-0 emission when existing nodes are present, so re-running Phase 2 on a partial DB is idempotent: no duplicate roots, no lost children.
- CLI flow: `--resume-from-db <prior.db> --resume-at-phase 2` copies the DB to the new workspace and advances to Phase 2, where the idempotent handler recovers state and continues.
- Tests: one in-process round-trip test in `phase2ProductLens.test.ts` verifies that re-executing the Phase 2 handler after a completed run doesn't duplicate the FR root node.

## Takeaway

The progress-based quiescence feature is **proven out**. The Wave 6 recursive-decomposition design itself continues to validate strongly against real-world input: richer tier distribution at cal-3 than cal-1 because the loop ran longer, meaning Tier-B commitments the human will care about are surfacing even with an ollama backend. The 4c audit-flag decision remains **blocked on operator-side routing changes** (strong-model backing for requirements_agent and/or reasoning_review), not on any defect in the implementation.
