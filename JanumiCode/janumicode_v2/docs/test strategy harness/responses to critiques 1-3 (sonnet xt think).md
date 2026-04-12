## Gap Triage Across All Three Critiques

Let me assess each finding honestly — validity, severity, and appropriate mitigation.

---

### Critique 001 (GLM 5) — Internal Consistency

**All eight gaps are valid. None are overstated.**

**1. CLI-In-Process Bridge — Valid, Critical**

If CLI and `workflowHarness.ts` are separate implementations they will drift. The shared `pipelineRunner.ts` core is the correct architectural fix. This should move into Wave 1.

*Mitigation:* Add `src/core/pipelineRunner.ts` as the shared engine. CLI wraps it. Harness wraps it. Neither contains pipeline logic of its own. Wave 1 file list is updated accordingly.

**2. Error Context Extraction — Valid, Moderate**

"First 100 lines of the handler file" is too vague. If the handler doesn't exist, there's nothing to summarize.

*Mitigation:* Add `GapErrorContext` as specified. Key distinction: `handlerMissing: true` returns `expectedHandlerPath` only; `handlerMissing: false` returns the relevant code snippet using the stack trace's line number as the extraction anchor, not a fixed line count.

**3. Semantic Key Injection — Valid, Critical**

`LLMCallOptions` has no field for the semantic key. The `MockLLMProvider` cannot do exact key matching without it.

*Mitigation:* Add `semanticKey?: string` to `LLMCallOptions`. `MockLLMProvider.call()` prefers exact key match; falls back to substring match for backward compatibility with existing Phase 0/1 fixtures.

**4. Universal Phase Contracts Layer — Valid, Important**

Without a universal contract layer, adding a second test case (not Hestami) requires rewriting all expectations from scratch.

*Mitigation:* Split into `phaseContracts.ts` (universal — schema validity, invariant checks, required record types) and `hestamiExpectations.ts` (domain-specific — content thresholds). The harness runs both; universal contracts run for any test case, domain expectations only for Hestami.

**5. Fixture Staleness — Valid, Important**

*Mitigation:* Add `prompt_template_hash: string` (SHA-256 of the template file) to `FixtureFile`. On fixture load, recompute the hash and throw `FixtureStalenessError` if it doesn't match. This catches the most common staleness case (template edited after capture) without being fragile to prompt context changes — those are addressed separately by Critique 002.

**6. Test Isolation — Valid, Critical**

Vitest runs tests in parallel by default. Multiple tests writing to the same SQLite path will corrupt each other.

*Mitigation:* Use unique database path per test run: `.janumicode/test_{crypto.randomUUID()}/governed_stream.db`. Clean up on test completion. In-memory SQLite is an option but loses the "human can debug the database" property that was explicitly preserved as a design goal.

**7. Error Classification Decision Tree — Valid, Moderate**

*Mitigation:* Add the decision tree as specified. Order matters: exception → missing records → schema violation → assertion failure → timeout. An empty `user_stories` array passes schema validation (it's a valid empty array) so it correctly falls through to the assertion layer.

**8. Auto-Approve Audit Format — Valid, Moderate**

The spec says auto-approvals are recorded with `produced_by_agent_role: auto_approve_adapter` but the full decision trace schema for auto-approved interactions is not defined.

*Mitigation:* Add `selected_option_index: number | null` and `auto_approved: true` to the standard `decision_trace` record rather than a separate record type. This keeps the Governed Stream taxonomy clean while making auto-approvals distinguishable from human decisions.

---

### Critique 002 (Antigravity) — Real-World Fidelity

**All six gaps are valid. Two are deferred by design; four need immediate mitigations.**

**1. False Positives in Mock Mode — Valid, Critical**

This is the most dangerous gap. A broken context engineer that produces an empty prompt still matches the semantic key and returns the golden fixture. The test passes; the product is broken.

*Mitigation:* Add `prompt_context_hash: string` to `FixtureFile` — a SHA-256 of the **critical input variables** extracted from the rendered prompt (not the full rendered prompt — see Gap 5). "Critical input variables" means the content of the injected artifacts, not the template scaffolding. The `MockLLMProvider` checks: if the incoming prompt's critical input hash differs by more than a configurable threshold (e.g., Jaccard distance > 0.3 on token sets), throw `FixtureContextDriftError` and fail the test. The threshold is configurable because minor template wording changes should not break fixtures, but dropping the entire Hestami document from context should.

**2. Golden Path Fallacy — Partially Deferred, Partially Immediate**

The auto-approve happy path deferral is correct for the initial build. However, the Menu index 0 selection is a real problem now: if the LLM returns candidates in a different order during capture than during real use, the harness tracks the wrong product concept.

*Mitigation:* Add `decision_overrides` to `HarnessConfig`: `{ "1_3": { "selection": "index_2", "rationale": "select Full Real Property OS scope" } }`. Auto-approve adapter checks overrides before defaulting to index 0. The human mutation testing (JSON Patch to mirror content) is explicitly deferred to post-initial-build.

**3. Brownfield Testing — Valid, Explicitly Deferred**

The spec correctly defers this for the initial build. However, it should be named as a planned test scenario.

*Mitigation:* Add to the Deferred Items section: "Day 2 Hestami test scenario — submit a follow-on prompt ('Add pet tracking to CAM pillar') against the Phase 0–10 output workspace; assert on `ingestion_conflict_list` and `refactoring_scope`."

**4. Token Limit Vulnerability — Valid, Important**

Mock mode masks context bloat. Phase 6+ will have massive context payloads that silently exceed real model limits.

*Mitigation:* Add `simulateTokenLimit?: number` to `MockLLMProvider`. Default: 128000 (Claude/GPT-4o equivalent). Uses `Math.ceil(prompt.length / 4)` as approximation. Throws `SimulatedTokenLimitExceededError` if exceeded. The error type feeds into the classification decision tree as a new `token_limit` category that suggests checking the Context Builder's detail file assembly.

**5. Repository Bloat — Valid, Simple Fix**

*Mitigation:* Remove `prompt_rendered` from the committed `FixtureFile` schema. Write rendered prompts to `.janumicode/.debug/rendered_prompts/{fixture_key}.txt` which is gitignored. `FixtureFile` retains `prompt_template` (the template file path) for staleness checking. Add a `--debug-prompts` CLI flag to enable rendered prompt output locally.

**6. Gap Collector CI Cost Leakage — Valid, Simple Fix**

*Mitigation:* Gap collector checks `process.env.CI === 'true'` OR `--disable-ai-suggestions` flag before making any LLM API call. In CI, always uses rule-based fallback. Log a note: "AI suggestions disabled in CI — run locally with `--ai-suggestions` to get LLM-generated fix guidance." This is a one-line guard but prevents significant unintended spend.

---

### Critique 003 (GPT-5.4) — Oracle Fidelity

**Six findings. Three are P1 valid and require immediate mitigations. Two are P2 valid. One is partially valid.**

**1. Wrong Ingress Path — Valid P1, Critical**

This is a fundamental issue the other critiques missed. The real user flow goes through `ClientLiaisonAgent` — file attachment ingestion, query classification, decision routing. If the CLI bypasses this and injects Raw Intent directly into the pipeline engine, the harness tests a different code path than what users actually exercise. File resolution, attachment handling, and query routing can all be broken while the harness goes green.

*Mitigation:* The CLI must route through the same `ClientLiaisonAgent` ingress as the sidebar flow. `@filepath` syntax is resolved to an attachment payload before the pipeline starts — not injected as a bare string. The CLI is not a shortcut around the ingress layer; it is a non-VS Code wrapper that exercises the same ingress. The spec's `--intent @filepath` becomes an attachment reference that `ClientLiaisonAgent` ingests. This may require `ClientLiaisonAgent` to support a non-interactive mode (classification + attachment parsing without a webview).

**2. Phase Topology Mismatch — Valid P1, Critical**

If the harness spec defines sub-phases (`2.4`, `2.5`, `3.4`, `3.5`, `4.4`, `4.5`, `5.5`, `5.6`, `8.4`, `8.5`, `9.5`) that don't exist in the canonical `SUB_PHASE_NAMES` in `records.ts`, one of two bad things happens: the harness fails against the real engine, or the engine is modified to satisfy the test document rather than the product spec.

*Mitigation:* The `phaseExpectations.ts` sub-phase IDs must be derived from `records.ts:SUB_PHASE_NAMES` — not from the JanumiCode product specification. Before Wave 1 begins, audit the canonical sub-phase list and align the harness expectations to it. If the product spec and the code disagree on sub-phase topology, that is a separate bug to fix in the engine — not something the harness should paper over. Add a startup check: `validateSubPhaseIds(phaseExpectations, SUB_PHASE_NAMES)` that throws if any expectation references a sub-phase ID not in the canonical list.

**3. Hestami Oracle Overfit — Partially Valid P1**

The critique is correct that `user_stories >= 40` and DBOS/accounting keyword checks will push implementation toward output-shaping rather than faithful reasoning. However, some content thresholds are legitimate — an empty `user_stories` array is a genuine correctness failure regardless of interpretation.

*Mitigation:* Separate content assertions into two tiers:

- **Structural assertions** (always enforced): arrays non-empty, required fields present, schema valid, invariants pass. These are stable across interpretations.
- **Semantic assertions** (advisory): thresholds like `>= 40 user stories`, keyword presence. These are logged as warnings, not failures. They inform the developer that the output may be too thin but don't block the green path. The harness produces a `semantic_warnings` section in the gap report.

The one exception: assertions derived directly from the spec document's own structure (e.g., "at least one user story per Hestami CDM domain" — 12 domains are enumerated explicitly) are stable and should remain as failures. The oracle is anchored to the document's explicit structure, not inferred thresholds.

**4. Governed Stream Lineage — Valid P1, Critical**

This is the most significant finding in all three critiques combined. The harness checks artifact presence and field contents. It does not check `derived_from_record_ids`, `source_workflow_run_id`, authority level progression, or decision-linked provenance. A phase could fabricate downstream artifacts that pass all content checks while being completely disconnected from the Governed Stream chain. This tests the wrong thing — a green harness would not prove JanumiCode's core governance value is working.

*Mitigation:* Add a `LineageValidator` to the harness that runs after each phase completes:

- Every Artifact produced in this phase has at least one `derived_from_record_id` pointing to an artifact from the previous phase (or the Raw Intent record for Phase 0)
- `source_workflow_run_id` matches the current `workflow_run_id` for all records in a greenfield run
- Authority levels are monotonically non-decreasing through the approval chain: Exploratory (1) → Agent-Asserted (2) → Human-Approved (5) → Phase-Gate-Certified (6) by end of phase
- Every `phase_gate_approved` record has a matching `decision_trace` record that preceded it

These are structural invariants of the Governed Stream — they do not depend on the Hestami document and belong in `phaseContracts.ts` (universal layer). Without them, the harness certifies artifact content but not JanumiCode's governance.

**5. Stale Repo View / Competing Oracle — Valid P2**

If `fullPipeline.test.ts` and `completePipeline.test.ts` already exist, the new harness should extend them rather than create a third competing set of expectations.

*Mitigation:* Before Wave 2 begins, audit existing test files. The new `hestamiProductDescription.test.ts` should either supersede or explicitly reference existing full-pipeline tests. A decision must be made: is `fullPipeline.test.ts` the source of truth, and the Hestami test is an extension? Or does the Hestami test replace it? This decision should be made and documented before any harness code is written.

**6. Shallow Phase 9/10 — Valid P2, Acknowledged**

The critique is right but the spec explicitly defers deep Phase 9 testing for the initial build. The one gap that should not be deferred: if `commit_record.commit_sha` is populated, it should be verified to actually exist in the git repository. A fabricated SHA that passes schema validation but points to nothing is a green test for a broken commit phase.

*Mitigation:* Add one Phase 10 assertion: `git cat-file -t {commit_sha}` returns `commit`. This is a 10-line check that validates the commit actually exists.

**7. Corpus Version Lock — Valid, Simple**

The critique catches that the Hestami file is already drifting (709 vs 708 lines).

*Mitigation:* Add `hestami_corpus_sha: string` to the test workspace manifest. Computed as SHA-256 of the Hestami document at fixture capture time. The harness checks it on load and throws `CorpusDriftError` if it doesn't match. This forces explicit re-capture when the corpus changes rather than silent drift.

---

## Consolidated Mitigation Summary

| # | Finding | Source | Severity | Action |
|---|---|---|---|---|
| 1 | Shared `pipelineRunner.ts` — no CLI/harness shared core | 001 | Critical | Add to Wave 1 |
| 2 | CLI must route through `ClientLiaisonAgent` ingress | 003 | Critical | Redefine CLI architecture |
| 3 | Sub-phase IDs must match `records.ts:SUB_PHASE_NAMES` | 003 | Critical | Audit before Wave 1 |
| 4 | Governed Stream lineage checks missing | 003 | Critical | Add `LineageValidator` to universal contracts |
| 5 | Prompt context drift causes mock false positives | 002 | Critical | Add `prompt_context_hash` + drift detection |
| 6 | `semanticKey` field missing from `LLMCallOptions` | 001 | Critical | Add field; update `MockLLMProvider` |
| 7 | Universal vs domain-specific contracts not separated | 001 | Important | Split into `phaseContracts.ts` + `hestamiExpectations.ts` |
| 8 | Decision overrides for Menu selections (not just index 0) | 002 | Important | Add `decision_overrides` to `HarnessConfig` |
| 9 | Fixture staleness detection | 001 | Important | Add `prompt_template_hash` |
| 10 | Simulated token limits in MockLLMProvider | 002 | Important | Add `simulateTokenLimit` |
| 11 | Test isolation (parallel vitest) | 001 | Important | Unique DB path per test run |
| 12 | Error classification decision tree | 001 | Moderate | Add to `gapCollector.ts` |
| 13 | `GapErrorContext` for LLM suggestions | 001 | Moderate | Add interface |
| 14 | CI cost guard on gap collector LLM calls | 002 | Moderate | Check `CI=true` before LLM call |
| 15 | Semantic assertions softened to warnings | 003 | Moderate | Two-tier: structural failures + semantic warnings |
| 16 | Corpus version lock | 003 | Moderate | SHA-256 the Hestami file; check on load |
| 17 | `prompt_rendered` must not be committed | 002 | Simple | Strip from `FixtureFile`; gitignore debug output |
| 18 | Auto-approve decision trace format | 001 | Simple | Add `auto_approved: true`, `selected_option_index` to `decision_trace` |
| 19 | Phase 10 commit SHA verification | 003 | Simple | `git cat-file -t {sha}` check |
| 20 | Existing full-pipeline tests — audit before Wave 2 | 003 | Process | Decide supersession vs extension |
| 21 | Brownfield Day 2 test scenario | 002 | Deferred | Name in Deferred Items |
| 22 | Human mutation testing via JSON Patch | 002 | Deferred | Post-initial-build |

Items 1–6 are prerequisites that must be resolved before Wave 1 begins. Items 7–19 are incorporated into the wave they affect. Items 20–22 are process or deferred.