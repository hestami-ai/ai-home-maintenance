# Wave 6 calibration decision — tag=wave6-cal-1 — date=2026-04-20

## Run context
- Workspace: `calibration-workspace/`
- Intent: `Review "specs/hestami-ai-real-property-os(2)/Hestami AI Real Property OS and Platform Product Description.md" and prepare for implementation.`
- `decomposition.reasoning_review_on_tier_c`: enabled for this run
- `llm_routing.requirements_agent.primary`: fell back to `direct_llm_api / ollama / qwen3.5:9b` (no workspace override present)
- `llm_routing.reasoning_review.primary`: `ollama / qwen3.5:9b` (workspace override)
- **Caveat 1**: the audit role is running on a smaller local model, not a strong reasoning API. Findings are informative but not definitive for the 4c-flag default decision until we wire a strong API for reasoning_review.
- **Caveat 2**: run hit the orchestrator's 3600s waitForQuiescence timeout during Phase 2.1a. Phase 1 ran to completion; Phase 2.1a was mid-saturation-loop (pass 1 finishing, pass 2 not started) when killed. Phase 2.2 (NFR) was not reached. Data below reflects the partial state.

## Run results (from partial DB snapshot)

### Timing

- Phase 0: ~10s
- Phase 1 (Intent Capture through Handoff Approval): **17 minutes, full completion**. 22 artifact records.
- Phase 2.1 (FR root bloom): produced 16 root FRs.
- Phase 2.1a (recursive decomposition): **60 minutes, partial** — 95 depth-1+ nodes emitted before timeout.
- Phase 2.2/2.2a (NFR bloom + recursion): **not reached**.

### Telemetry — FR tree (partial, pass 1 only)

- Total nodes: **110** (16 roots + 55 depth-1 + 39 depth-2)
- Atomic Tier-D leaves: **13** (already frozen)
- Pending: 97 (awaiting gate resolution / later passes)
- Pruned / downgraded / deferred: **0 / 0 / 0** (pass 2 not reached; no rejections in auto-approve)
- Tier distribution: **1 A / 10 B / 70 C / 13 D / 16 root**
- Assumption snapshots: 1 (pass 1 only)
- Depth reached: 2

### Telemetry — NFR tree

- Empty — Phase 2.2 was not reached.

### Mirror gates emitted

- **6 Tier-B gate bundles** under sub-phase 2.1a, surfaces `decomp-gate-US-004`, `decomp-gate-US-005`, `decomp-gate-US-006`, `decomp-gate-US-013`, `decomp-gate-US-015`, `decomp-gate-US-016` — one per Level-1-equivalent parent that produced Tier-B children. Option-B simultaneous-gating behavior confirmed.

### Audit verdict tally

- **0 audit records produced**. Reason: the 4c audit fires on post-gate re-decomposition passes (tierHint='B' → produces Tier-C/D). That pass never started — the saturation loop was still in pass 1 when timed out.

### Step 4b mislabel detections

- **9 "decomposer disagrees with tier hint" warnings logged** across the run, all on depth-0 root nodes where the decomposer assessed the parent as Tier B (not 'root'). None triggered a `downgraded` supersession because the mislabel-detection path fires only when `tierHint === 'B'` and these had `tierHint === 'root'`. The disagreements themselves are a correct observation: the Hestami spec's root user stories are already at commitment granularity.

## Four-pass review

### Pass 1 — tree sanity: **PASS (strong)**

Walked the depth-0 roots and the Tier-B commitments they produced. Observations:

- **Root FRs are commitment-shaped**, not coarse functional areas. Examples: *"Initiate a repair request with address and key details"*, *"View portfolio risk and budget variance metrics"*, *"Cast vote on annual budget"*. This is consistent with the rich-spec-enters-at-Tier-B hypothesis — the decomposer's disagreement with the 'root' hint was correct, not a bug.
- **Tier-B commitments name genuine scope commitments at the right granularity** for human gate review. Examples:
  - `US-004-4`: *"utilize WF-3 Dispatch Scheduling Engine for all scheduling logic"* — architectural commitment with a clear workflow name.
  - `FR-013-01`: *"Define ENT-MEDIA-ITEM schema extension for 'asset_rights_owner'"* — data-structure commitment.
  - `FR-013-04`: *"Validate rights owner ID against ENT-USER or ENT-ASSOCIATION"* — governing rule commitment.
  - `US-005-2`: *"define mandatory documentation rules for job completion"* — business-policy commitment.
- **Tier-D atomic leaves have concrete, testable measurable_conditions**. Samples:
  - `FR-007-03` → *"INSERT INTO ENT-VOTE returns unique row with voter_id, vote_option, and hash"*
  - `US-009-04` → *"SELECT count(*) FROM ENT-PURCHASE-ORDER WHERE order_number = {PO_NUM} AND id IS..."*
  - `FR-ACCT-1.1.2` → *"property_id in (SELECT id FROM properties) === true"*
  - `US-016-3` → *"HTTP status 400 and body contains message 'Notice Period Expiry Prevented'."*
  These answer *"does the system do X correctly?"* cleanly — verification-shaped, not policy-shaped.
- **Tier distribution is naturally skewed toward C/D** (70+13 out of 94 non-root/non-A) because the rich intent enters at Tier B. This is the tier system adapting to input granularity correctly — the `Tier-A` safety net existed (1 node) but wasn't primary.

### Pass 2 — audit precision on policy-verdicts: **N/A (not exercised)**

Zero audit records produced. The 4c audit pathway requires post-gate re-decomposition (tierHint='B' on a previously-accepted commitment), which happens in saturation-pass-2+. The run timed out during pass 1. **Re-run required** against a faster LLM backend (codex_cli / claude_code_cli) so saturation reaches pass 2 and the audit fires.

### Pass 3 — recall spot-check: **N/A (not exercised)**

Same reason — no audit records to spot-check non-flagged leaves against.

### Pass 4 — NFR applies_to_requirements sanity: **N/A (not exercised)**

Phase 2.2 not reached. NFR recursion remains tested only under mock-mode unit tests.

## Verdict

- [ ] Promote `reasoning_review_on_tier_c` to default-on
- [x] **Keep flag default-off; re-run against a faster/stronger backend before deciding**
- [ ] Tune prompt and re-run

## Rationale

1. **The Wave 6 design validates under real-world input.** The tier-based decomposition, per-parent mirror gates, and tier self-assessment all behaved as intended against the full Hestami spec. Tier-B gates look genuinely decidable; Tier-D leaves look genuinely testable.
2. **But the full calibration decision (Pass 2 + Pass 3) cannot be made from this run** because the 4c audit path wasn't reached. That's the decision gate we need evidence against.
3. **Ollama qwen3.5:9b is too slow for full-pipeline calibration.** ~60 minutes to produce 95 depth-1+ FR nodes implies ~3-5 hours total for FR alone with pass 2+ and ~6-10 hours including NFR. The orchestrator's 3600s quiescence timeout can't accommodate this.

## Next iteration plan (wave6-cal-2)

1. **Switch requirements_agent backing to a CLI** — `export JANUMICODE_REQUIREMENTS_AGENT_BACKING=codex_cli` (or claude_code_cli / gemini_cli). Strong-CLI calls should complete decomposition faster, and the outputs are higher-fidelity for tier-self-assessment.
2. **Also route reasoning_review to a strong API model** — `GOOGLE_API_KEY` or equivalent, point workspace config's `llm_routing.reasoning_review.primary` at `{ provider: 'google', model: 'gemini-2.0-flash-thinking' }` per DEFAULT_CONFIG. This resolves Caveat 1 so the audit findings are trustworthy.
3. **Raise orchestrator waitForQuiescence timeout** to 4+ hours for full-pipeline runs, OR invoke the CLI with `--phase-limit 2` to exit cleanly after Phase 2 completes, OR break the run into phase-limited chunks with `--resume-from-db`.
4. **Re-run `scripts/wave6-calibration-run.js`** on the same intent with the above env, then apply the full four-pass review. At that point Pass 2 + Pass 3 become actionable for the 4c-flag default decision.

## Wave 6 mechanism observations (persist beyond this iteration)

- **Step 4b tier-hint disagreement logging worked**: the decomposer consistently flagged rich-spec inputs as Tier B rather than 'root', giving the orchestrator the signal needed for future mislabel detection.
- **Tier-based routing adapts to input richness as designed**: Hestami's detailed spec produced mostly Tier-C/D output at depth 1-2, which is what the tier model promises for richly-specified intents.
- **Per-parent mirror gates emitted correctly**: 6 distinct `decomp-gate-<parent>` bundles, one per Level-1-equivalent parent with Tier-B children. Option-B simultaneous-gating (Promise.all pauseForDecision) is working.
- **Atomic AC shape quality is high even from qwen3.5:9b**: Tier-D ACs cited specific SQL, HTTP codes, workflow IDs, and schema field names. This supports the user's earlier note that smaller models are adequate for some leaf-level operations — though we haven't yet tested the Tier-B commitment-naming quality of smaller vs stronger models side by side.

## Files

- Partial FR decomposition gold: [`calibration-gold/product_fr_decomposition.wave6-cal-1.gold.json`](product_fr_decomposition.wave6-cal-1.gold.json) (146 KB, 110 nodes)
- NFR gold: **not produced** (Phase 2.2 not reached)
- Run DB (read-only reference): `calibration-workspace/.janumicode/test-harness/1776703209852.db`
