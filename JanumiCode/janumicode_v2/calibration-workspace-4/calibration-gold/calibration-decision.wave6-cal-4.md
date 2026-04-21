# Wave 6 calibration decision — tag=wave6-cal-4 — date=2026-04-20/21

## Run context
- Workspace: `calibration-workspace-4/`
- Resumed from: `calibration-workspace/.janumicode/test-harness/1776708617792.db` (cal-3 DB, Pass 1 complete + Pass 2 partial)
- CLI invocation: `--resume-from-db <cal-3 DB> --resume-at-phase 2`
- `decomposition.reasoning_review_on_tier_c`: enabled
- `llm_routing`: ollama/qwen3.5:9b for both `requirements_agent` and `reasoning_review` (unchanged)
- Features under test:
  1. **Saturation-loop resume** (rebuildSaturationStateFromStream) — first real-world validation
  2. **Phase 2.1/2.2 idempotent re-entry** — no duplicate root emissions
  3. **Step 4c AC-shape audit pathway** — first run where it actually fired

## Resume validation: STRONG PASS

On invocation, the log recorded:
```
Resuming run 5502087c-... at Phase 2
Phase 2.1 RESUME: using existing depth-0 FR nodes; skipping bloom {"existingRoots":20}
Phase 2.1a RESUME: reconstructed state from stream
  {"queueSize":135,"assumptions":49,"passNumber":1,"llmCallsUsed":83,"maxDepthReached":2}
```

- 20 existing FR roots preserved — no duplicate depth-0 emissions.
- 135 pending nodes restored to the work queue.
- 49 cumulative assumptions carried forward.
- Pass counter + LLM budget + max depth all restored.

No wasted cal-3 work; every recorded state element recovered correctly.

## Node/tree growth vs cal-3

| Metric | Cal-3 final | Cal-4 latest snapshot | Δ |
|---|---|---|---|
| Decomposition nodes (current) | 256 | **771** | +201% |
| Atomic Tier-D leaves | 53 | **183** | +245% |
| Downgraded supersessions (Step 4b) | 0 | **18** | — |
| Deferred nodes | 0 | 0 | healthy |
| Max depth | 2 | **3** | +1 level |
| Mirror gate bundles | 15 | **49** | +227% |
| **4c audit records** | 0 | **18** | first signal |

The hung node from cal-3 (`FR-ISO-1.2`) decomposed cleanly on resume at 21:43 — confirms user's manual-replay observation that the hang was sampler non-determinism, not a prompt defect.

## Step 4b (tier-downgrade) findings — 18 supersessions

Step 4b fired aggressively across the resume run. Sample of the 18 downgraded parents:

```
FR-US-004-3     producedTierB=2   explicitDisagreement=false
FR-PAY-003      producedTierB=1   explicitDisagreement=false
US-007.4        producedTierB=1   explicitDisagreement=false
FR-FIN-1.3      producedTierB=2   explicitDisagreement=false
FR-SEC-001      producedTierB=2   explicitDisagreement=false
FR-VER-002      producedTierB=2   explicitDisagreement=false
FR-EXT-2, FR-EXT-5, FR-US-003-4.1, FR-US-004-1.1, FR-US-004-1.4,
FR-STOR-004-2, FR-016-02.3, US-010-C-01-01, US-010-C-01-02  …
```

All 18 triggered via the *implicit* signal (post-gate parent produced MORE Tier-B children, not explicit tier-assessment disagreement). The decomposer genuinely reveals that many "accepted commitments" hide further commitment layers — consistent with the Hestami spec's rich commitment space.

These 18 are exactly the cases where the human, in a real calibration, would revisit scope.

## Step 4c (AC-shape audit) findings — 18 records, 69 findings

**Verdict tally across 69 child-level findings:**

| Verdict | Count | % |
|---|---|---|
| verification | 68 | 98.6% |
| policy | 0 | 0% |
| ambiguous | 1 | 1.4% |

**Parents with any policy-verdict:** 0 of 18 (0%)

**Sample verification rationales (model-produced):**
- *"AC cites a concrete '30 seconds' threshold for ping/pong heartbeat; no external policy decision needed."*
- *"AC specifies '500ms' latency bound between log entry and payload, enabling direct measurement."*
- *"AC defines rejection criteria ('missing, expired, revoked') as cache states, which are system-enforceable."*

The rationales are appropriate and the sampled ACs do look verification-shaped. BUT:

## Four-pass review

### Pass 1 — tree sanity: PASS (stronger than cal-3)

Running tally: 771 nodes, 183 atomic leaves, 49 mirror gates, depth 3 reached. Tier distribution 37 root / 11 A / 77 B / 397 C / 183 D.
Tier-D ACs continue to be concrete and testable (SQL conditions, explicit thresholds, HTTP codes, schema fields, measurement windows). Step 4b's 18 downgrades are genuine findings — the orchestrator would correctly re-gate those as scope-expansion context.

### Pass 2 — audit precision: INCONCLUSIVE / SUSPECT

- 68 verification verdicts — we can verify the rationales match the ACs (spot check: yes they do).
- **0 policy verdicts** — so we cannot measure precision on the actual failure mode the audit is designed to catch.
- Either (a) Step 4b is absorbing all the mislabels upstream, leaving 4c with only clean inputs, or (b) qwen3.5:9b as auditor is biased toward "verification" and would miss real policy-shaped ACs.

Without a stronger reasoning_review model, we can't disambiguate (a) from (b). The 80%-TP-rate threshold from the operator checklist can't be evaluated against zero policy findings.

### Pass 3 — recall spot-check: CANNOT ASSESS

Same blocker — if the auditor never flags policy, we can't sample "not-flagged" leaves to see if any should have been flagged. The sample base is all "verification," all confirmed verification by manual inspection.

### Pass 4 — NFR applies_to_requirements: N/A

Phase 2.2 still not reached; the cal-4 run is still mid-Phase-2.1a with 570 pending nodes left.

## Verdict

- [ ] Promote `reasoning_review_on_tier_c` to default-on
- [ ] Keep flag default-off; re-run with stronger reasoner required
- [x] **Flag stays default-off. The 4c pathway is PROVEN to execute correctly, but precision/recall cannot be calibrated against qwen3.5:9b as the auditor because it returns only verification verdicts on this sample. Upgrade `reasoning_review` routing to a stronger API model (gemini-2.0-flash-thinking / claude-opus / gpt-5) and re-run against a workspace with `llm_routing.reasoning_review.primary` pointed at the strong model — then four-pass review becomes fully actionable.**

## What landed as validated

1. **Records-idle stall + heartbeat logging**: proven out across cal-3 and cal-4. Cal-4 ran for 4+ hours without a spurious stall.
2. **Saturation-loop resume + Phase 2.1/2.2 idempotency**: proven out on first real-world invocation. No data loss on cal-3→cal-4 transition.
3. **Step 4b tier-downgrade mechanism**: fired 18 times with clear signal — each a genuine "your accepted commitment has commitments underneath" case.
4. **Step 4c AC-shape audit pathway**: implementation confirmed executing. Reasoning review model sees clean Tier-C input, renders verdicts + rationales on each child AC. Pipeline mechanics: ✓. Calibration-grade quality signal: pending strong-model routing.

## Follow-ups for wave6-cal-5

1. Route `llm_routing.reasoning_review.primary` at a strong API reasoner (gemini-2.0-flash-thinking or equivalent). This is the single most important change for the 4c-flag decision.
2. Optionally set `JANUMICODE_REQUIREMENTS_AGENT_BACKING=codex_cli` (or similar strong-CLI) to speed up the FR decomposition loop. Cal-4 took ~4h of ollama compute to reach depth 3; a strong CLI could plausibly finish FR saturation in under an hour.
3. Re-run with a still-resuming-from pattern — cal-4 itself didn't complete, and its partial DB can be resumed again into cal-5. This is now a supported pattern.

## Files

- Partial FR decomposition gold: will be extracted after cal-4 completes or stalls.
- Run DB: `calibration-workspace-4/.janumicode/test-harness/resume-1776719733932.db`
- Predecessor decision: `calibration-decision.wave6-cal-3.md` (cal-3 was the stall run that cal-4 resumed from).
