# Wave 6 Step 4c — `reasoning_review_on_tier_c` calibration procedure

This doc captures the operator-side procedure for enabling the Step 4c AC-shape audit on a live run, inspecting the findings, and deciding whether to promote the flag to default-on. It is the follow-up to the out-of-the-box default of `decomposition.reasoning_review_on_tier_c: false`.

## Why the flag is off by default

Each audit call adds one `reasoning_review` LLM invocation per post-gate Tier-C decomposition pass. On a typical product-lens run with ~10 Level-2-equivalent commitments, that's up to 10 extra API calls per root FR beyond the normal decomposition budget. For most runs this is small, but we haven't calibrated:

- Whether the audit's **precision** is high enough to trust advisory findings as-is.
- Whether the audit's **recall** is high enough that "no findings" actually means no policy-shaped ACs slipped through.
- Whether the audit's latency tail is acceptable within the overall saturation-loop budget.

Until those three questions are answered against real runs, default-off preserves the Wave 6 pipeline's baseline budget.

## One-run calibration procedure

### 1. Choose a run with known latent commitments

Pick a spec rich enough that Tier-B mislabeling is plausible. The Hestami HOA spec is the canonical choice — the accounting subtree has known commitment-layer depth under categories like *"Manage Assessments"* and *"Tax Filing"*.

### 2. Enable the flag in config

Either:

```bash
# via env override at CLI invocation:
JANUMICODE_DECOMPOSITION_REASONING_REVIEW_ON_TIER_C=1 \
  node dist/cli/janumicode.js run --intent-file ... --workspace ... --llm-mode real
```

or edit `.janumicode/config.json` under the run's workspace:

```json
{
  "decomposition": {
    "reasoning_review_on_tier_c": true
  }
}
```

### 3. Confirm `reasoning_review` routing targets a strong API model

The audit routes through `llm_routing.reasoning_review.primary`. Production default is `{ provider: 'google', model: 'gemini-2.0-flash-thinking' }`. Do not point it at a smaller model for calibration — audit calibration under a weak reasoner tells you nothing about the flag itself. If Gemini access is unavailable, switch to an equivalent-tier Anthropic or OpenAI reasoning model via `llm_routing.reasoning_review.primary`.

### 4. Run the workflow to Phase 2 completion

Wait for the run to reach sub-phase `2.3` or later. Every post-gate Tier-C decomposition pass will have emitted a `reasoning_review_record` with `content.kind === 'tier_c_ac_shape_audit'`.

### 5. Extract the findings

```bash
node scripts/extract-phase2-decomposition.js \
  --db .janumicode/governed_stream.db \
  --out-fr /tmp/fr_decomp.gold.json \
  --out-nfr /tmp/nfr_decomp.gold.json
```

Each gold file's `audit_records[]` contains the audit findings. For each record, inspect:

- `parent_node_id` — which Tier-B commitment was audited.
- `children_reviewed` — the Tier-C children under that parent.
- `findings[]` — per-child verdict (`verification` / `policy` / `ambiguous`) + rationale.
- `policy_count` — aggregate count per audit.
- `summary` — the model's one-line take.

### 6. Human cross-check: true-positive rate on `policy` verdicts

For every finding with `verdict: 'policy'`, ask yourself:

> *"Could a developer write a deterministic test for this AC today, using only what the AC + handoff + ancestor context provides?"*

If yes → the audit falsely flagged this as policy-shaped (false positive).
If no → the audit correctly identified a latent commitment (true positive).

Log your judgment next to each audit record. **Threshold for promoting to default-on: ≥ 80% true-positive rate across audits**, with no finding where the audit missed a commitment that a reviewer considers obvious (false-negative check in step 7).

### 7. Recall spot-check: sample Tier-C leaves the audit did NOT flag

From the FR + NFR trees, pick ~10 random atomic leaves whose parent was Tier-B and whose audit returned zero policy verdicts. Apply the same developer-test question to their ACs. If any of these reveal policy-shaped ACs the audit missed, recall is too low to trust default-on.

### 8. Latency tail check

Inspect the `produced_at` timestamps of the audit records relative to the surrounding `requirement_decomposition_node` and `assumption_set_snapshot` records for the same pass. Audit calls should typically complete within ~10s of the decomposer call that preceded them. If p99 latency exceeds 30s, the audit is blocking saturation-loop progress more than it should — profile the reasoning_review prompt before promoting.

### 9. Decision matrix

| Precision | Recall | Latency p99 | Action |
|---|---|---|---|
| ≥ 80% | No obvious misses | ≤ 30s | Promote to default-on in `defaults.ts` + `configManager.ts` |
| < 80% | — | — | Tune the audit prompt (adjust verification/policy examples) + re-run |
| ≥ 80% | Obvious misses | — | Strengthen the "does a developer need a human decision first?" framing in the prompt + re-run |
| ≥ 80% | No misses | > 30s | Batch multiple parents into one audit call (prompt change + saturation-loop change) before promoting |

## Followups after promotion

If the flag goes default-on:

1. Add a dashboard metric for `audit.policy_count` aggregated per run so operators can spot calibration drift as models change.
2. Consider emitting a workflow-level warning when `audit.policy_count > 0` — today it's a log line only, not a surfaced warning.
3. Revisit whether `reasoning_review_on_tier_c=true` should also trigger a tier-downgrade supersession automatically (currently advisory-only by design; promote to active action only with calibration evidence).

## Current status (2026-04-20)

- Flag exists, default off.
- Prompt template: `.janumicode/prompts/cross_cutting/tier_c_ac_shape_audit.system.md`.
- Advisory-only behaviour: findings land in `reasoning_review_record` but do not auto-prune or auto-downgrade.
- **Calibration has not yet been performed.** First Hestami real-run that enables the flag is the calibration event.
