# Wave 6 operator checklist — calibration run + NFR capture

One-page procedure for the **first live run** that exercises Wave 6's recursive FR + NFR decomposition end-to-end against a real LLM. This is what turns the two remaining open items into closed items:

- Item A — validate NFR recursion produces sensible trees against a real spec.
- Item B — collect calibration evidence to decide whether `reasoning_review_on_tier_c` should be promoted to default-on.

## Prerequisites

- [ ] Workspace directory exists (e.g. `e:/Projects/hestami-ai/test-workspace/calibration`).
- [ ] Intent file prepared (e.g. the Hestami spec at `JanumiCode/janumicode_v2/src/test/fixtures/hestami-product-description/intent.md`).
- [ ] Latest dist built: `node esbuild.js` — produces `dist/cli/janumicode.js` and `dist/webview/main.js`.
- [ ] Strong-model CLI available in PATH (one of `codex`, `claude-code`, `gemini`) OR a direct API key for the configured `requirements_agent` provider.
- [ ] Strong-model API key for the `reasoning_review` role (Google / Anthropic / OpenAI depending on routing).

## Environment variables to set

```bash
# Strong CLI for requirements_agent (Phase 2.1a / 2.2a decomposition)
export JANUMICODE_REQUIREMENTS_AGENT_BACKING=codex_cli   # or claude_code_cli / gemini_cli
# (Optional) override the model the CLI uses
export JANUMICODE_REQUIREMENTS_AGENT_MODEL=<model-id>

# Strong API for reasoning_review (Step 4c AC-shape audit)
export GOOGLE_API_KEY=<key>            # default production uses gemini-2.0-flash-thinking
# or ANTHROPIC_API_KEY / OPENAI_API_KEY if routing is overridden
```

## Run

```bash
node scripts/wave6-calibration-run.js \
  --intent /path/to/intent.md \
  --workspace /path/to/workspace \
  --out-dir /path/to/workspace/calibration-gold \
  --tag codex-iter-1
```

The script will:

1. Write `decomposition.reasoning_review_on_tier_c: true` into `<workspace>/.janumicode/config.json`.
2. Invoke `dist/cli/janumicode.js run --llm-mode real --auto-approve --json` against the intent.
3. Extract `product_fr_decomposition.codex-iter-1.gold.json` + `product_nfr_decomposition.codex-iter-1.gold.json` via `extract-phase2-decomposition.js`.
4. Print a calibration summary (tier distribution, audit verdict tally, per-kind telemetry).

Expected run time: 5–30 minutes depending on model + spec complexity. Watch for:
- Budget-cap trips (look for `termination_reason: budget_cap` in the pipeline summary) → sign the spec is richer than 500 LLM calls/root; either raise the cap or investigate decomposer bloat.
- Zero NFR nodes in the tree → Phase 2.2 didn't produce any root NFRs; check `non_functional_requirements` artifact in the DB.

## Post-run review

### Pass-1: does the tree look sensible?

Open the workspace's governed stream in the webview (F5 from VS Code). You should see:

- **ONE `FR Decomposition` pipeline card** with per-pass deltas + final totals + expandable root-FR trees.
- **ONE `NFR Decomposition` pipeline card** (borderline yellow) with the same structure.
- No stray top-level `requirement_decomposition_node` or `assumption_set_snapshot` cards — they should all be nested inside the pipeline cards.

Walk 1–2 root FR trees manually. For each Tier-B child the human was gated on, check:
- The commitment it names is something you (operator / domain expert) would actually have committed to at that granularity — not too coarse, not too fine.
- Its Tier-C/D children's ACs contain measurable conditions, not policy choices.

### Pass-2: calibration on the audit findings

Open the gold FR file. For each record in `audit_records[]` with `findings[n].verdict === 'policy'`:

- [ ] Quote the child's acceptance criterion.
- [ ] Answer *"Could a developer write a deterministic test for this AC today, using only what the AC + ancestor chain + handoff provides?"*
- [ ] If **yes** → false positive (audit mislabelled a real verification as a policy choice).
- [ ] If **no** → true positive (audit correctly caught a latent commitment).

**Threshold for promoting 4c to default-on: ≥ 80% true-positive rate on policy verdicts.** If the rate is below 80%, tune the prompt template at `.janumicode/prompts/cross_cutting/tier_c_ac_shape_audit.system.md` (adjust the verification/policy examples for your domain language) and re-run. Repeat until 80% precision is reached or the procedure convinces you the audit's utility is marginal.

### Pass-3: recall spot-check

From each gold file, sample 10 random atomic Tier-C/D leaves that the audit did NOT flag (or that had no associated audit record). Apply the same developer-test question. If any reveal commitment-level scope slipped through silently, recall is too low for default-on.

### Pass-4: NFR applies_to_requirements sanity

For each NFR leaf in the gold NFR tree, inspect `applies_to_requirements[]`:
- Every listed id should exist in the FR gold as an atomic leaf id.
- If an NFR leaf has no `applies_to_requirements`, it's a cross-cutting NFR — note whether that's correct (e.g. "all of the system must be audit-logged") or an omission (should have targeted specific FR leaves).

The Phase 2 consistency check's `validateRequirementsProductTraceability` validator already catches unknown trace ids on runs post-Wave 5; any findings there should also be reviewed.

## Decision

After the four passes, fill in this decision record in the gold directory as `calibration-decision.<tag>.md`:

```markdown
# Calibration decision — tag=<tag> — date=<YYYY-MM-DD>

## Precision on audit policy-verdicts
<N-of-M true-positive rate>

## Recall spot-check (10 samples)
<0-10 missed findings, with notes>

## Latency p99 (audit call)
<approximate from produced_at timestamps>

## Verdict
- [ ] Promote `reasoning_review_on_tier_c` to default-on in defaults.ts + configManager.ts
- [ ] Keep flag default-off; document reason below
- [ ] Tune prompt and re-run (attach next-iteration plan)

## Notes
<anything operator wants to remember for next calibration>
```

## If the flag is promoted

1. Flip defaults: `defaults.ts` and `configManager.ts` both set `reasoning_review_on_tier_c: true`.
2. Update [`docs/wave6_reasoning_review_calibration.md`](./wave6_reasoning_review_calibration.md) "Current status" section to reflect the decision + date + calibration-tag.
3. Update the project memory note [`project_wave6_complete.md`](../../../../C:/Users/mchen/.claude/projects/e--Projects-hestami-ai/memory/project_wave6_complete.md) so future sessions know the flag is live.
4. Consider emitting a workflow-level warning (not just a log line) when `audit.policy_count > 0` on a run.

## If calibration reveals unfixable precision issues

Document in the decision record, flip back `reasoning_review_on_tier_c: false`, and file a follow-up task. The Wave 6 Step 4c infrastructure remains in place; the flag just stays opt-in until we have a better audit prompt or a better auditor model.

## Known limitations

- Mock-mode runs (`--llm-mode mock`) don't exercise the audit path meaningfully; calibration requires real-mode against a strong reasoner.
- Auto-approve mode accepts every mirror gate; for human-in-the-loop calibration runs, drop `--auto-approve` and resolve gates from the webview.
- The calibration script doesn't yet support resuming from a partial run. If the CLI crashes mid-run, delete `.janumicode/governed_stream.db` and restart.
