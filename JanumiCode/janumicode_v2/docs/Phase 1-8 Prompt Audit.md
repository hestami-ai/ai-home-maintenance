# Plan: Phase 1–8 Prompt-Materialization Audit (sub-agent harness)

## Context — why
Phase 6 (a monolithic 922 s task-skeleton call + a full-AC-catalog injected into every per-component call) and Phase 7 (a 77 K-token saturation call injecting the entire FR/AC catalog twice for a 1-AC test case) revealed a **class** of defect, not two one-offs. The class has two faces:

1. **Prompt bloat** — a core agent's materialized prompt injects full upstream *catalogs / raw artifacts* when the call only needs a scoped slice, or asks one call to cover N items beyond a reliable single response.
2. **Materialization-fidelity gaps** — a template slot that upstream data *should* fill renders empty/sentinel. The user's cited symptom ("tech stack captured upstream but not filled into a downstream prompt") is exactly this; static analysis already found its mechanism (defects #5/#6/#7) plus a sibling (Phase 8 `compliance_context_summary` hardcoded to `'No compliance regimes'`, #4).

cal-29 produced a complete P1–P8 dataset (~4.8 K LLM calls in `governed_stream`). We can now audit **empirically**: for every CORE agent call, compare the role's *intent* against its *materialized prompt*, *thinking*, and *response* along a fixed, discrete rubric — and produce a **per-role × per-dimension defect matrix** with exacting per-call evidence, so the fixes (template scoping / injection wiring) are driven by data, not anecdote.

**Outcome:** (a) a re-runnable audit *script* + agreed measurement-dimension catalog; (b) a ranked finding report naming which roles have bloat / materialization gaps, with quoted evidence and suggested fixes; (c) empirical confirm/refute of the 7 static pre-findings + discovery of any others.

## Scope & exclusions
- **Phases 1–8 only.** P0 (ingestion) and P9 (execution / genericity — a separate track) excluded.
- **CORE generative roles only.** Exclude validators/gatekeepers/routers/mechanical: `intent_quality_check`, `intent_lens_classification`, `scope_gatekeeper` (+ downstream gatekeepers), `reasoning_review`, `json_repair`, and all `produced_by_agent_role='harness'`. Rationale: these are *additive* — they wrap other long-form prompts/outputs, so long prompts are expected and not a defect.
- **Data = cal-29** `…/calibration-workspace-cal-29/.janumicode/test-harness/resume-1782771124303.db` (the most complete shard; all shards are cumulative).

## Static pre-findings (confirm/refute empirically; do not assume)
| # | Defect | Phase | Status | Class |
|---|---|---|---|---|
| 1 | Full AC catalog → per-component task skeleton | 6 | FIXED (e82e537) | global-catalog into scoped call |
| 2 | Monolithic orphan-AC reconciliation (all in one call) | 6 | FIXED (e82e537) | monolithic call at scale |
| 3 | Full AC catalog → per-test-case saturation | 7 | FIXED (`renderScopedAcSummary`) | unscoped context in child call |
| 4 | `compliance_context_summary` = literal `'No compliance regimes'` | 8 | **OPEN** | placeholder always filled with empty fallback |
| 5 | TECH-* absent from P6–8 when P1 gate not authority-promoted (DMR ≥6 path) | 6–8 | **OPEN** | authority-gated upstream binding lost |
| 6 | P4 component-narrowed TECH-* not rendered into P6 skeleton `component_model_summary` | 6 | **OPEN** | upstream narrowing not carried forward |
| 7 | Reconciliation-path tasks never stamped `active_constraints` (skip `normalizeRootTaskShape`) | 6 | **OPEN** | normalization gap on non-skeleton path |

## Data model — extraction (confirmed)
Single read-only join over `governed_stream` (better-sqlite3). `json_extract` array indexing is unreliable in the bundled SQLite → join on `instr()`:
```sql
SELECT inv.phase_id, inv.sub_phase_id AS sub_phase, inv.produced_by_agent_role AS role,
       json_extract(inv.content,'$.label')  AS label,
       json_extract(inv.content,'$.system') AS system_prompt,   -- NULL for core agents ([JC:SYSTEM SCOPE] inline in prompt)
       json_extract(inv.content,'$.prompt') AS user_prompt,
       json_extract(out.content,'$.text')   AS response,
       json_extract(out.content,'$.thinking') AS thinking,       -- nullable
       json_extract(out.content,'$.input_tokens')  AS input_tokens,
       json_extract(out.content,'$.output_tokens') AS output_tokens,
       length(coalesce(json_extract(inv.content,'$.system'),'')||json_extract(inv.content,'$.prompt')) AS prompt_chars,
       inv.id AS invocation_id, inv.produced_at AS started_at
FROM governed_stream out
JOIN governed_stream inv ON instr(out.derived_from_record_ids, inv.id) > 0
WHERE out.record_type='agent_output' AND inv.record_type='agent_invocation'
  AND CAST(inv.phase_id AS INTEGER) BETWEEN 1 AND 8
  AND inv.produced_by_agent_role != 'harness'
ORDER BY CAST(inv.phase_id AS INTEGER), inv.produced_at;
```
Then drop the validator/router/mechanical `sub_phase`s (above) in code. Gotchas: `system` is NULL for core agents (whole prompt is in `$.prompt`); `thinking` nullable; use `instr()` not `$[0]`; all timestamps UTC. Code refs: `agentInvoker.ts:624–648` (invocation), `:727–761` (output + `derived_from_record_ids`), `schema.ts:86–118` (DDL), `invocationLogger.ts:94–297` (`.log` fallback writer).

## CORE role set (audit targets, by phase)
- **P1:** `scope_bounding`, `intent_domain_bloom`(×3 lenses), `product_intent_discovery`, `technical_constraints_discovery`, `compliance_retention_discovery`, `vv_requirements_discovery`, `canonical_vocabulary_discovery`, `business_domains_bloom`, `user_journey_bloom`, `user_journey_decomposition`, `system_workflow_bloom`, `system_workflow_decomposition`, `entities_bloom`, `integrations_qa_bloom`, `product_description_synthesis`, `release_plan`.
- **P2:** `fr_bloom_skeleton`, `fr_bloom_enrichment`, `fr_saturation`, `nfr_bloom_skeleton`, `nfr_bloom_enrichment`, `nfr_saturation`.
- **P3:** `system_boundary`, `system_requirements`, `interface_contracts`.
- **P4:** `software_domains`, `component_skeleton`, `component_saturation`, `adr_capture`.
- **P5:** `data_model_skeleton`, `data_model_saturation`, `api_definitions`, `error_handling`, `configuration_parameters`.
- **P6:** `task_skeleton`, `task_reconciliation`, `task_saturation`.
- **P7:** `test_case_skeleton`, `test_case_saturation`.
- **P8:** `evaluation_design`.

Template-render mechanism (for evidence interpretation): `TemplateLoader.render()` (`templateLoader.ts:274`) substitutes `{{var}}`; a missing var is **left literal and only warns** — so unfilled placeholders survive into the materialized prompt (directly detectable). Tech-stack injection points: explicit `{{technical_constraints_summary}}` in P3/P4/P5 (`formatTechnicalConstraintsSummary`, `phase3.ts:1034`, `phase5.ts:149`); P6–8 get TECH-* only via `{{active_constraints}}` from DMR (≥6 authority) — the gap.

## Measurement-dimension catalog (the "issues" — discrete & exacting)
Each is one independently-checkable question with a defined evidence requirement and a `none/low/med/high` severity. Split into a cheap exhaustive **deterministic pre-pass** (runs on *every* core call, no LLM) and **judgment dimensions** (sub-agent, given intent+prompt+thinking+response).

**Deterministic pre-pass (D, exhaustive):**
- **D1 Size** — `prompt_chars`, approx tokens (`ContextBuilder.approximateTokens`, 4 ch≈1 tok), actual `input_tokens`; per-role distribution → flag p90/p99 + absolute-budget breaches.
- **D2 Unsubstituted placeholder** — literal `{{…}}` remaining in the materialized prompt (render miss).
- **D3 Empty/sentinel slot** — a labeled section rendered empty or carrying a known sentinel (`No compliance regimes`, `(No task-specific technical constraints`, `N/A`, `undefined`, `null`, `[]`, `{}`). *This catches the tech-stack/compliance class directly.*
- **D4 Intra-prompt duplication** — near-duplicate paragraph/block hashes (the P7 "injected twice").
- **D5 Catalog over-injection ratio** — count enumerated IDs (`AC-*`,`comp-*`,`TECH-*`,`US-*`,`NFR-*`) injected vs referenced in the response → injected-but-unused fraction.

**Family A — Prompt economy (judgment):**
- **A1 Over-scoped injection** — full catalog/corpus injected where only this call's slice is needed (confirms D5 with judgment).
- **A2 Raw firehose** — entire upstream artifact dumped as raw JSON vs a curated kind-aware excerpt.
- **A3 Monolithic ask** — call told to cover N independent items beyond one reliable response → truncation/coverage loss.
- **A4 Dead context** — large blocks neither the role intent nor the response uses.
- **A5 Redundant boilerplate** — instructional/template content repeated within the prompt.

**Family B — Materialization fidelity (judgment):**
- **B1 Missing upstream binding** — a decision captured upstream that the role's intent requires but is absent (the TECH-* / compliance gap), judged against what the response needed.
- **B2 Empty-slot semantics** — a D3-flagged empty slot that *should* have carried content (severity = did it matter for this call).
- **B3 Wrong-scope / stale injection** — injected data belongs to a different target/version than this call.
- **B4 ID/namespace mismatch** — injected IDs don't match the namespace the role must join against.
- **B5 Intent–prompt mismatch** — prompt fails to equip the model for its stated intent (missing required inputs / contradictory instructions).

**Family C — Downstream symptom (judgment, from thinking/response):**
- **C1 Starvation signal** — model asks for missing info / invents a value (hallucinated stack) / hedges.
- **C2 Coverage shortfall** — response covers fewer targets than the prompt enumerated.
- **C3 Instruction-drowning** — response violates an explicit instruction plausibly buried by bloat.
- **C4 Format/parse fragility** — response shape drift downstream joins can't consume.

Each judgment check returns `{present, severity, evidence(quote+location), suggested_fix, confidence}`; the sub-agent also returns an overall intent-fulfilment score. The catalog is a **versioned JSON registry** the harness iterates — adding a dimension never silently drops prior coverage.

## Harness design (extract script + Workflow fan-out + report script)
Three pieces. The two node scripts are the durable, re-runnable artifacts; the Workflow is the in-session launcher.

- **Stage 0 — Extract** `scripts/prompt-audit/extract.ts` (node + better-sqlite3, **read-only**): run the join; apply the CORE-vs-excluded classifier; write one self-contained `audit-out/calls/<invocation_id>.json` per core call (`{meta, system, prompt, thinking, response}`); compute **D1–D5 deterministically into `meta`** (size, unsubstituted `{{}}`, empty/sentinel slot, intra-prompt dup, catalog over-injection ratio) over the *full* prompt; emit `audit-out/manifest.json` = `[{slug, invocation_id, role, sub_phase, phase, path, det_flags, prompt_chars}]` grouped by role. Middle-truncate the rare >p99 prompts in the call file to a ~120 K-token cap with a `…[N chars elided]…` marker (D1–D5 already ran on the full text). *(Exhaustive, cheap, no LLM.)*
- **Stage 1 — Workflow fan-out** (in-session): main loop `Read`s `manifest.json` and passes the 828 targets as `args` to `Workflow`. The workflow script `pipeline`s/`parallel`s over targets; each `agent(focusedPrompt, {schema: VERDICT_SCHEMA, label: slug})` is told the role's **intent** (from the inventory), reads its `calls/<id>.json`, and returns the full-rubric verdict `{D1..D5 confirmation, A1..A5, B1..B5, C1..C4} each {present, severity, evidence, suggested_fix, confidence}` + overall intent-fulfilment score. Schema validation ⇒ a target can never be silently dropped (the "nothing lost to context limits" guarantee). Crash recovery via `resumeFromRunId` (completed `agent()` calls are cached); the agents also `Write` `audit-out/results/<slug>.json` for an at-rest per-item drop. The dimension rubric is a **versioned `dimensions.json`** the workflow reads — adding a dimension never drops prior coverage.
- **Stage 2 — Report** `scripts/prompt-audit/report.ts` (node): read `results/*.json` → write `audit-out/audit-report.md`: per-role × per-dimension defect matrix, roles ranked by weighted defect density, top findings w/ quoted evidence + suggested fixes, per-role size distributions, and an explicit **confirm/refute line for each of the 7 static pre-findings**. Re-runnable independently of the Workflow.

## Scale (measured from cal-29, read-only)
Core generative calls (P1–8, current-version): **828** — `requirements_agent` 302, `implementation_planner` 289, `test_design_agent` 79, `technical_spec_agent` 79, `domain_interpreter` 71, `systems_agent` 3, `architecture_agent` 3, `orchestrator` 1, `eval_design_agent` 1. (Saturation loops dominate: `fr_saturation` 192, `task_saturation` 233, `data_model_saturation` 75, `test_case_saturation` 78, `component_saturation` 47.)
Prompt-size distribution (chars): min 9.6 K · **median 55 K** · p90 148 K · p99 261 K · **max 384 K (~96 K tokens)** · total ≈ 61.8 M chars (~15.5 M tokens). The size spread *is itself* a preliminary bloat signal — D1 ranking will localize it per role.
**Excluded** (utility/validator/router): `harness`, `ingestion_pipeline_stage3` (gate/verifier/compose), `reasoning_review`, `json_repair`, `deep_memory_research` (≈12 calls — optional add-on track), and sub_phases `intent_quality_check`/`intent_lens_classification` + all `*_gate`/`*_verifier`/`*_compose`/`*_review_prep`. The extract script's classifier finalizes membership and flags any ambiguous `ingestion_pipeline_stage3`-only sub_phase (e.g. `scope_bounding`) for a sampled human check.

## Resolved decisions (user)
1. **Granularity = per call, full rubric** — one sub-agent per call scores all judgment dimensions on that call's intent+prompt+thinking+response.
2. **Coverage = exhaustive** — every one of the 828 core calls gets an LLM sub-agent (deterministic D1–D5 run on all anyway). 828 < 1000 → single Workflow run; if the finalized set exceeds ~950, slice into 2 resumable Workflow batches.
3. **Backend = in-session Workflow** — `agent({schema})` fan-out; faster/cheaper per sub-agent than `claude -p`. The reusable *extract* + *report* scripts remain the durable artifacts; the Workflow is the launcher.

## Verification (how we'll know it works)
- Re-run extract → the 3 FIXED defects now read CLEAN on cal-29 (D5/A1 low for `task_skeleton`/`test_case_saturation`); if not, the fix didn't take in this run.
- The 4 OPEN defects appear as findings with quoted evidence (e.g. D3 fires on P8 `evaluation_design` `compliance_context_summary`; B1 fires on P6–8 missing TECH-*).
- Spot-check 3–4 `results/<slug>.json` against the source `.log` file by hand to confirm the auditor's evidence quotes are real (no fabrication).
- Harness is crash-resumable: kill mid-run, `--resume`, confirm no target re-audited and none dropped (`sweep-state.json` accounting matches `results/` count).

## Critical files
- **Reuse:** `scripts/thin-slice-review.js` (`truncate()` byte-budgeting + per-call review-prompt assembly — the closest precedent), `scripts/model-bakeoff/reportGenerator.ts` (rolling-markdown pattern), `dspy/src/exportTrainset.ts` (read `governed_stream` → per-invocation export), `src/lib/orchestrator/contextBuilder.ts:374` (`approximateTokens`). Workflow `resumeFromRunId` replaces the `sweepState.ts` state machine for crash recovery.
- **Read-only refs:** `src/lib/database/schema.ts:86` (DDL), `src/lib/orchestrator/agentInvoker.ts:624,727` (record shapes), `src/lib/llm/invocationLogger.ts` (`.log` fallback), the role-inventory + materialization map (this session's Explore output).
- **New:** `scripts/prompt-audit/extract.ts` (Stage 0), `scripts/prompt-audit/dimensions.json` (versioned rubric), `scripts/prompt-audit/audit.workflow.js` (Stage 1 Workflow script), `scripts/prompt-audit/report.ts` (Stage 2). Output under `scripts/prompt-audit/audit-out/` (`calls/`, `results/`, `manifest.json`, `audit-report.md`).

---
## Parked (superseded)
Prior content: the gemma4:31b full-intent calibration-run plan (executed → cal-29, stopped at P9 by user to pivot to this audit); the mimo-default-executor + layout-divergence + DMR/supersession plans (shipped). All captured in session memory.
