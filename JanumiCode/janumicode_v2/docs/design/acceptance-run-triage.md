# Acceptance Run Triage

Run: first full `pnpm test:acceptance` against live Ollama, 2026-05-20
Result: **11 pass / 14 fail · 42 minutes**
Source: `C:\Users\mchen\AppData\Local\Temp\claude\.../tasks/b8k02e6d6.output`

## Triage methodology

Each failure is classified as:
- **CONTRACT** — the contract is over-strict or has a field-name mismatch; fix in `src/test/contracts/*.contract.ts`. Same class as Gap #3 and Gap #7 corrections from the prior session.
- **PROMPT** — the LLM produced what the prompt asked for, but the prompt doesn't ask for what downstream needs. Fix in `prompts/**/*.system.md`.
- **MODEL** — the LLM ignored / partially followed the prompt; possibly model-capability artifact. May resolve with stronger prompt constraint, model upgrade, or response_format enforcement.

Triage of a failure follows the Gap #7 pattern: read the actual LLM output, compare to the prompt's stated schema, compare to the contract's expectations. Discrepancies between any pair identify the class.

## The 14 failures

### Block 1 — Probably CONTRACT refinements (Gap #7 class)

| # | Boundary | Failure | Hypothesis | Verification |
|---|---|---|---|---|
| 1 | **1.0a intent_quality_check** | `processable` not boolean | LLM emits string or wraps in object | Inspect raw response; read intent_quality_check prompt schema |
| 2 | **1.0b product_intent_discovery** | `product_concept` missing | LLM emits at different path (e.g. nested under `product`) | Inspect raw response; reconcile with prompt schema |
| 5 | **1.3a user_journey_bloom** | `userJourneys` missing or not an array | LLM emits `journeys` (snake/camel drift) | Add tolerant field-name alias to contract |
| 6 | **1.6 product_description_synthesis** | `product_concept.name` missing | Likely emits at different path | Same |
| 10 | **5.1 data_model_skeleton** | 1 group invalid component_id | comp-* enforcement too strict | ✅ FIXED (commit batch) |
| 12 | **6.1 task_skeleton** | 24/24 invalid component_id | comp-* enforcement too strict | ✅ FIXED — see iteration loop demo below |
| 13 | **7.1 test_case_skeleton** | 6 suites invalid identifiers | comp-* enforcement too strict | ✅ FIXED |

### Block 2 — Probably PROMPT issues (real prompt bugs)

| # | Boundary | Failure | Hypothesis | Fix direction |
|---|---|---|---|---|
| 3 | **1.0d compliance_retention** | 4 items, all empty descriptions | Prompt doesn't insist on prose content per item | Prompt edit: require non-empty description text per item |
| 4 | **1.0e vv_requirements** | 6 items, all empty descriptions | Same | Same |
| 7 | **1.9 release_plan** | 2 releases empty `contains[]` axes | Prompt allows empty axes silently | Prompt edit: require at least one axis populated per release |
| 8 | **2.2 nfr_bloom_skeleton** | 19 NFRs missing threshold/measurement | Prompt doesn't enforce both fields strongly | Prompt edit: both fields required; reject NFR otherwise |
| 9 | **4.2 component_skeleton** | 3 components missing US-* refs | Gap #2 edit partially landed; LLM dropped requirement on some components | Prompt edit: explicit "every component MUST cite at least one US-*; emit `[]` is forbidden" |
| 11 | **5.3 error_handling** | 13 groups missing scenario/response text | Same shape-not-enforced pattern as 1.0d/1.0e | Prompt edit: require non-empty scenario+response per entry |

### Block 3 — MODEL behavior

| # | Boundary | Failure | Hypothesis | Fix direction |
|---|---|---|---|---|
| 14 | **8.1 evaluation_design** | Response not JSON; echoed system prompt | Model rendered the JC:SYSTEM SCOPE text instead of producing artifact | Strengthen JSON-only constraint; verify `response_format: 'json'` is set on the call; possibly larger model |

## Distribution

- **CONTRACT bugs: 7** (1.0a, 1.0b, 1.3a, 1.6, 5.1, 6.1, 7.1) — 3 already fixed in this triage push
- **PROMPT bugs: 6** (1.0d, 1.0e, 1.9, 2.2, 4.2, 5.3) — require prompt template edits
- **MODEL bugs: 1** (8.1) — requires either prompt or model adjustment

Ratio matches Gap #7 pattern: roughly half the failures the harness surfaces are over-strict contracts; the rest are real upstream issues.

## What the run validated

1. **The harness works end-to-end.** 25 boundaries executed, structured pass/fail per clause.
2. **The 11 passes are real.** Phases 1.0c/1.0f/1.1a/1.2/1.3b/1.4/2.1/3.1/4.1/4.3/5.2 produce contract-conformant output today.
3. **Many "broken" Gap-fix boundaries are actually working better.** 4.2 went from 9 missing US refs (ts-17 diagnose) → 3 missing (live acceptance). Gap #2 edit landed partially.
4. **The iteration loop is fast.** Demonstrated: edit contract, re-run single boundary, get pass/fail in ~3.5 minutes.

## Demonstrated iteration loop — 6.1 task_skeleton

```
Original contract: C-6.1.4 required comp-* prefix on component_id
                   ✖ 24/24 tasks fail (all use whatever the component_model uses, which varies)

Observation: Phase 6 prompt explicitly says "VERBATIM component id... Never prepend comp-".
             So the convention is "copy whatever component_model has."

Edit: relaxed C-6.1.4 to require "id token, not prose". The resolvability check (C-6.1.5)
      still enforces that task.component_id resolves in the component model.

Re-run: pnpm vitest run --config vitest.live.config.ts -t "6.1_task_skeleton"
Result: ✓ in 216s (3.6 minutes).
```

This is the loop that would have taken hours via thin-slice in the prior session.

## Recommended next moves

1. **Burn down Block 1 (contract refinements) first.** They're cheap and quickly knock down the failure count to surface what's left.
2. **Then Block 2 (prompt edits).** Each prompt edit can be validated per-boundary in ~3 min.
3. **Block 3 (8.1) last** — likely needs deeper investigation.
4. **Re-run full `pnpm test:acceptance`** when Block 1 + 2 are done to confirm green.

This burn-down can plausibly close out all 14 in a focused session, with each fix validated immediately rather than waiting for the next thin slice.
