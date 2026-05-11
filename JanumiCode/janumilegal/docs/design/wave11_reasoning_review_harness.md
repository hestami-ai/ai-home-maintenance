# Wave 11 — Reasoning-Review Harness (Validator Catalog)

**Status:** Design (not yet implemented)
**Authored:** 2026-05-09
**Predecessors:** Wave 10 (LLM/agent harness), Wave 10.1 (routing, fallback, JSON repair, thin-slice routing-driven mode)
**Counterparts in v2:** [`JanumiCode/janumicode_v2/src/lib/review/`](../../janumicode_v2/src/lib/review/) — `domainComplianceReview.ts` + `harness/` (~50 LLM validators, deterministic validators, validator registry, final synthesis decision).

---

## 1. Objective

Make reasoning quality of every state output **measurable, auditable, and gate-able** within JanumiLegal — not just structurally valid JSON. The harness:

1. Runs a curated set of validators against each `(state, prompt, output)` tuple.
2. Uses a **decorrelated reviewer model** (different provider/model from the primary state agent) to reduce shared reasoning errors.
3. Writes per-finding records to the matter track at the appropriate privilege classification.
4. Produces a `final_synthesis` decision: `pass | escalate | block`.
5. Feeds those decisions into the existing **Release Gate Evaluator** so a state cannot release client-facing or court-bound artifacts when high-severity reasoning findings are open.

This is the legal-domain analog of v2's `reviewHarness.ts` adapted to:
- **Privilege classifications** (work_product_factual / work_product_mental).
- **Authority verification tiers** (`source_located | quote_matched | machine_assessed_support | attorney_confirmation_required`).
- **AttorneyAction model** (no validator can self-confirm release; high-severity findings always require attorney review).
- **CLV term scope** (every validator declares the CLV terms it reasons about; cross-CLV reasoning is itself a validator).

## 2. Non-goals

- **Not** a replacement for Tier 12 governance agents — those run at higher granularity (lens-completion, intent-drift across activations). The harness runs **per state output**.
- **Not** a citator. Authority tier checks live in Wave 6's authority verification subsystem; the harness validates that authority *use* is grounded but does not adjudicate treatment.
- **Not** an attorney substitute. The harness produces machine-assessed findings only. `attorney_review_required: true` is non-negotiable for all client/filing artifacts; harness output is supporting evidence for the attorney's review, not a release authority.

## 3. Architectural placement

```
┌────────────────────────────────────────────────────────────────────┐
│ Orchestrator.advanceNextState()                                    │
│   ├─ Agent.execute(envelope, input)                                │
│   │     ├─ LlmBackedAgent → primary provider (e.g. qwen2.5:9b)     │
│   │     │     └─ JSON repair loop (Wave 10.1)                      │
│   │     └─ output                                                  │
│   ├─ NEW: ReviewHarness.review(stateOutput)                        │
│   │     ├─ selectValidators(stateId, output) → [v1, v2, …]         │
│   │     ├─ run deterministic validators (sequential)               │
│   │     ├─ run LLM validators via reviewer provider                │
│   │     │     (e.g. gemma2:e4b, decorrelated from primary)         │
│   │     ├─ collate findings                                        │
│   │     ├─ final_synthesis (LLM) → pass/escalate/block             │
│   │     └─ write reasoning_review_record + findings to matter track│
│   └─ orchestrator status:                                          │
│         pass     → state completes                                 │
│         escalate → state completes; attorney_review_required:true  │
│                    pinned and surfaced in dashboard                │
│         block    → state escalated; downstream blocked             │
└────────────────────────────────────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────────────┐
│ ReleaseGateEvaluator.evaluate(artifact)                            │
│   ├─ existing prerequisites (signed AttorneyAction, …)             │
│   └─ NEW: any unresolved HIGH-severity reasoning findings on the   │
│           artifact's source state → external_release_blocked      │
└────────────────────────────────────────────────────────────────────┘
```

Validators run **inline per state** (not batch post-activation). Inline placement is required because downstream states consume upstream outputs as authorized prior artifacts; a quietly bad upstream poisons everything downstream.

## 4. Validator interface (Layer 1)

```ts
// src/lib/reasoningReview/types.ts

export type ValidatorFamily =
  | 'cross_state'              // applies to every state (grounding, JSON discipline)
  | 'fact_extraction'          // FactExtraction, ExistingOrderExtract
  | 'authority'                // AuthorityVerification, citations everywhere
  | 'issue_bloom'              // IssueBloom three-pass discipline
  | 'issue_prune'              // pruning rationales
  | 'conclusion'               // DirectLegalConclusionDraft
  | 'client_advice'            // ClientAdviceDraft
  | 'filing'                   // CourtFilingDraftGenerate
  | 'release'                  // ReleaseStatusDetermine
  | 'final_synthesis';         // last validator; collates upstream findings

export type ValidatorKind = 'deterministic' | 'llm';

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ValidatorRuntimeParams {
  readonly stateId: string;
  readonly agentId: string;
  readonly stateOutput: unknown;        // parsed JSON
  readonly stateOutputText: string;     // raw completion (for echo/extract checks)
  readonly assembledPrompt: { system: string; user: string };
  readonly envelope: AgentInvocationScope;
  /** Authorized prior artifacts from upstream states (CLV-scoped). */
  readonly priorArtifactsByState: ReadonlyMap<string, unknown>;
  /** Findings from validators that already ran this turn — final_synthesis reads. */
  readonly upstreamFindings?: readonly ValidatorFinding[];
}

export interface ValidatorFinding {
  readonly validatorId: string;
  readonly severity: Severity;
  readonly type: string;                // validator-specific finding type
  readonly message: string;
  /** CLV terms this finding bears on. */
  readonly clvScope: readonly string[];
  /** Privilege classification for the finding's matter-track record. */
  readonly classification: 'work_product_factual' | 'work_product_mental';
  /** Optional structured evidence for the dashboard. */
  readonly evidence?: Readonly<Record<string, unknown>>;
}

interface BaseValidatorEntry {
  readonly id: string;
  readonly family: ValidatorFamily;
  readonly description: string;
  readonly appliesTo: (p: { stateId: string; output: unknown }) => boolean;
  /** CLV terms the validator reasons about. Surfaced for VCC and audit. */
  readonly clvScope: readonly string[];
}

export interface DeterministicValidatorEntry extends BaseValidatorEntry {
  readonly kind: 'deterministic';
  readonly validate?: (p: ValidatorRuntimeParams) => readonly ValidatorFinding[];
}

export interface LlmValidatorEntry extends BaseValidatorEntry {
  readonly kind: 'llm';
  /** Path under `prompts/review/<family>/<id>.system.md`. */
  readonly promptTemplatePath: string;
  readonly invoke?: (
    p: ValidatorRuntimeParams,
    deps: { provider: LLMProvider; templateRegistry: PromptTemplateRegistry; clv: CLV },
  ) => Promise<readonly ValidatorFinding[]>;
}

export type ValidatorEntry = DeterministicValidatorEntry | LlmValidatorEntry;
```

## 5. Validator catalog (initial set)

The legal-domain analog of v2's ~50 validators. Initial catalog of **24 validators** across 9 families. Each one has a one-sentence rationale; full prompt templates author after a first calibration pass. Validators marked **(D)** are deterministic; **(L)** are LLM-backed.

### 5.1 cross_state (apply to every state — 6 validators)

| ID                                  | Kind | What it checks |
|-------------------------------------|------|----------------|
| `output_schema_conformance`         | D    | Output matches the state's declared output schema (manifest-driven). |
| `clv_scope_adherence`               | D    | Output references no CLV terms outside the state's declared `clvScope`. |
| `verification_status_floor`         | D    | No completion claims `verified` / `attorney_confirmed`; max tier `machine_assessed*`. Mirrors Wave 6 audit. |
| `quote_provenance`                  | D    | Every quoted span in the output is byte-identical to a span in an authorized source. |
| `grounding_validator`               | L    | Every assertion in the output traces to either an authorized source or a declared assumption. |
| `reasoning_to_response_faithfulness`| L    | The output's stated reasoning does not contradict the output's conclusions or omit material steps. |

### 5.2 fact_extraction (3 validators)

| ID                                  | Kind | What it checks |
|-------------------------------------|------|----------------|
| `fact_classification_discipline`    | L    | document_supported_facts each cite a specific authorized source; client_reported_facts are *not* upgraded to document-supported without quoted text. |
| `allegation_vs_fact_separation`     | L    | No allegations from a client narrative are silently classified as established facts. |
| `unknown_facts_completeness`        | L    | The "unknown_facts" bucket includes facts the issue analysis would need but the record lacks. |

### 5.3 authority (3 validators)

| ID                                  | Kind | What it checks |
|-------------------------------------|------|----------------|
| `authority_citation_grounding`      | L    | Every cited authority appears in the activation's authority retrieval set; no fabricated citations. |
| `authority_status_tiering`          | D    | Per-authority status uses only the four allowed tiers and `overall_authority_status` ≤ `machine_assessed_support`. |
| `attorney_confirmation_required_set`| D    | `attorney_confirmation_required: true` is set whenever any authority is referenced. |

### 5.4 issue_bloom (3 validators — Proposal C three-pass discipline)

| ID                                  | Kind | What it checks |
|-------------------------------------|------|----------------|
| `seed_coverage_pass1`               | L    | Pass-1 candidates cover every lens-defined seed domain (or record explicit non-applicability). |
| `divergence_pass2`                  | L    | At least one off-seed candidate or attestation that the matter genuinely doesn't admit divergence. |
| `dampening_pass3`                   | L    | Pass-3 introduces no new domains — refinement only. New-domain in pass-3 escalates. |

### 5.5 issue_prune (2 validators)

| ID                                  | Kind | What it checks |
|-------------------------------------|------|----------------|
| `pruning_decision_completeness`     | D    | Every bloomed candidate has exactly one decision; no silent removals. |
| `pruning_rationale_substance`       | L    | `remove` decisions have affirmative basis (not mere "peripheral"); `defer` decisions name the artifact set that would re-activate them. |

### 5.6 conclusion (2 validators)

| ID                                  | Kind | What it checks |
|-------------------------------------|------|----------------|
| `conclusion_certainty_language`     | D    | Output contains no banned certainty phrases ("guaranteed", "certain to win", "will absolutely"). |
| `conclusion_adverse_consideration`  | L    | The conclusion lists at least one adverse consideration and one `could_change_if` condition; absence triggers HIGH. |

### 5.7 client_advice (2 validators)

| ID                                  | Kind | What it checks |
|-------------------------------------|------|----------------|
| `release_status_floor_advice`       | D    | `send_status` is `external_release_blocked` (no AttorneyAction supplied at draft time). |
| `tone_caveat_completeness`          | L    | `includes_caveats: true` is supported by content (tone is `cautious`/`reassuring` and the message names the next attorney action). |

### 5.8 filing (2 validators)

| ID                                  | Kind | What it checks |
|-------------------------------------|------|----------------|
| `filing_release_status_floor`       | D    | `filing_release_status` is `external_release_blocked`; `signature_required: true`. |
| `argument_authority_alignment`      | L    | Each `argument_outline.authorities[]` entry maps to an authority the activation actually retrieved (no orphan citations). |

### 5.9 release (1 validator)

| ID                                  | Kind | What it checks |
|-------------------------------------|------|----------------|
| `release_map_floor`                 | D    | `draft_client_advice_message` and `draft_court_filing` are `external_release_blocked` unless an AttorneyAction record is supplied for the artifact version. |

### 5.10 final_synthesis (always last — 1 validator)

| ID                                  | Kind | What it checks |
|-------------------------------------|------|----------------|
| `final_synthesis`                   | L    | Reads all upstream findings + state output and emits a single decision: `pass | escalate | block`. Decorrelated reviewer model. |

**Total: 24 validators (12 deterministic, 12 LLM).**

## 6. Decorrelation discipline

The harness MUST NOT use the same `(provider, model)` pair as the primary state agent. Routing slot:

```ts
// Add to FirmLlmRouting (Layer 3 alias of Layer 1 AgentRoutingConfig)
export interface AgentRoutingConfig {
  // … existing fields …

  /**
   * Reviewer provider used by the reasoning-review harness. MUST resolve to
   * a different (provider, model) tuple than `defaultProvider`.
   * Layer-1 invariant: a runtime check throws if the tuple equals the
   * primary's tuple at agent-build time.
   */
  readonly reviewerProvider?: ProviderName;
  readonly reviewerModel?: string;
  readonly reviewerFallback?: ProviderName;
}
```

Calibration default for local Ollama:
- Primary: `ollama / qwen2.5:9b` (good JSON discipline)
- Reviewer: `ollama / gemma2:e4b` (good reasoning discipline)
- Final-synthesis reviewer: **same gemma2 instance** (decision: option A — one model swap is sufficient at calibration scale; further decorrelation is overkill until evidence shows synthesis-decision instability).

## 7. Matter-track record schema

Two new event types written by the harness via `MatterTrackWriter`:

```ts
type ReasoningReviewHarnessEvent = {
  eventType: 'reasoning_review_harness';
  payload: {
    stateId: string;
    agentId: string;
    validatorIds: string[];
    decision: 'pass' | 'escalate' | 'block';
    severityCounts: { HIGH: number; MEDIUM: number; LOW: number };
    reviewerProvider: string;
    reviewerModel: string;
    /** Hash of the (state output, validator set) for replay determinism. */
    inputHash: string;
  };
  // declaredClassification: 'work_product_factual'
};

type ReasoningReviewFindingEvent = {
  eventType: 'reasoning_review_finding';
  payload: ValidatorFinding & { harnessRunId: string };
  // declaredClassification: 'work_product_mental' for LLM findings
  //                         'work_product_factual' for deterministic findings
};
```

LLM findings are mental impressions (a model is reasoning about reasoning); deterministic findings are factual (rule-derived). Both encrypted under the matter-mental and matter-content keys respectively per Wave 3.

## 8. Op-track signal (for dashboard)

Op-track event `reasoning_review_completed` carries metadata only:
```ts
{ stateId, decision, severityCounts, reviewerLatencyMs, validatorsRun, validatorsUnavailable }
```
Specifically — **no validator finding text on op-track.** Findings are matter-bound mental impressions.

## 9. Failure semantics

| Situation                                 | Behavior                                                  |
|-------------------------------------------|-----------------------------------------------------------|
| Validator throws                          | Record `validator_unavailable` finding; severity LOW; harness continues |
| Reviewer provider unreachable             | Record harness-level `reviewer_unavailable`; decision = `escalate`; never `pass` |
| `final_synthesis` returns invalid JSON    | JSON-repair loop (1 attempt); on failure, decision = `escalate` |
| Loop guard: state agent IS the reviewer   | Throw at agent-build time (decorrelation invariant) |

Closed: a missing reviewer NEVER silently passes. Default-deny is the discipline.

## 10. Release-gate integration

Extend `ReleaseGateEvaluator.evaluate()`:

```ts
// Existing prerequisites: signed AttorneyAction, privilege frame, etc.
// NEW prerequisite:
const openHigh = matterTrack
  .findings({ artifactSourceState: state, severity: 'HIGH' })
  .filter((f) => !f.resolvedByAttorneyActionId);
if (openHigh.length > 0) {
  return { status: 'external_release_blocked', reason: `${openHigh.length} unresolved HIGH reasoning finding(s)` };
}
```

Resolution of a HIGH finding requires an AttorneyAction record explicitly acknowledging it (new `acknowledgedFindings: string[]` slot on the AttorneyAction).

## 11. Implementation sequence (commits)

1. **Foundation** — `src/lib/reasoningReview/types.ts`, `harness.ts` (dispatch loop, no validators), `validatorRegistry.ts` (empty registry), record-writing.
2. **Decorrelation invariant** — extend `AgentRoutingConfig`, runtime check at factory time, test for invariant violation.
3. **6 deterministic validators** — cross_state §5.1's 4 deterministic + §5.5/§5.6/§5.7/§5.8/§5.9's 6 deterministic; tests against fixture outputs.
4. **6 LLM validators (Tier 1)** — `grounding_validator`, `reasoning_to_response_faithfulness`, `fact_classification_discipline`, `authority_citation_grounding`, `seed_coverage_pass1`, `final_synthesis`. Prompt templates authored at `prompts/review/<family>/<id>.system.md`.
5. **6 LLM validators (Tier 2)** — `divergence_pass2`, `dampening_pass3`, `pruning_rationale_substance`, `conclusion_adverse_consideration`, `argument_authority_alignment`, `tone_caveat_completeness`.
6. **Remaining 6 LLM validators** — `allegation_vs_fact_separation`, `unknown_facts_completeness`, plus saturation as gold matters surface gaps.
7. **Release-gate integration** + AttorneyAction `acknowledgedFindings` slot.
8. **Calibration sweep** — re-run all 3 gold matters under harness; record reviewer agreement rate; tune severity thresholds. Extend gold-capture protocol with reviewer findings as a fourth captured artifact class (alongside op-track, matter-track, state outputs).
9. **CI gate hardening** — `ReasoningReviewHarness` failure on any of the 3 gold matters fails CI (analog of v2's gold-matter assertion set).

## 12. Wave 11 exit gate

- [ ] All 24 validators registered (deterministic implementations + LLM prompt templates).
- [ ] Decorrelation invariant test passes (harness throws when reviewer == primary).
- [ ] Thin slice runs end-to-end with reviewer pass and produces a `reasoning_review_harness` event per state.
- [ ] Release gate blocks on synthetic HIGH-severity finding.
- [ ] All 3 gold matters pass with reviewer agreement (zero unexpected `block` decisions; expected `escalate` decisions match annotated gold expectations).
- [ ] Calibration documentation updated: gold-capture protocol §reviewer findings authored.
- [ ] Tier 12 governance agents updated to *consume* reviewer findings (Intent Drift Detector reads upstream `final_synthesis` decisions).

## 13. Resolved decisions

1. **Per-validator timeout** — **decided.** Timeout is enforced at the **LLM-API-call level**, not at the validator or harness level. Each LLM provider already exposes a `timeoutMs` setting (`OllamaSettings.timeoutMs` defaults to 120s). The harness does NOT add an additional timer wrapper. A timed-out provider call surfaces as a thrown error inside the validator, which the harness records as `validator_unavailable` (per §9 failure semantics) and continues. Rationale: timing is a property of the network/model interaction, not of the reasoning-review logic; layering another timer on top would obscure root cause when calls are slow.

2. **Caching** — **decided.** No cache. Every finding — deterministic and LLM — is written through `MatterTrackWriter` under its declared privilege classification. Replays recompute. Determinism is a property of the validator's code; if a deterministic validator produces different findings on identical input across runs, that's a regression bug to investigate, not a cache-hit miss to suppress. Rationale: a separate cache would split findings across two storage models (one privilege-classified, one not), break the audit trail, and optimize a non-problem (deterministic validators are microsecond-cheap).

3. **`final_synthesis` decorrelation** — **decided (option A).** The `final_synthesis` validator runs on the **same reviewer model** as the per-validator LLM passes (e.g., gemma2:e4b for local-Ollama calibration). Decorrelation is enforced only between primary and reviewer; not between reviewer and synthesizer. If the first calibration sweep shows synthesis decisions disagree systematically with attorney annotations, escalate to option B (third decorrelated model) as a Wave 11.1 follow-up.

## 14. Open design questions (decide during implementation)

1. **Saturation termination** — analogous to issue-bloom saturation, does the harness need its own pass-budget? Initial answer: no, the validator catalog is bounded; saturation is enforced upstream by issue-bloom.

## 15. Out of scope for Wave 11

- Webview surfacing of findings — Wave 12.
- Human-in-the-loop reviewer agreement metrics (attorney annotates a captured workspace, system computes agreement) — Wave 12.
- Adversarial / red-team validators specifically targeting prompt-injection in source documents — Wave 13 (red-team harness).

---

**Counterpart files in v2 to study before coding:**
- [`reviewHarness.ts`](../../janumicode_v2/src/lib/review/harness/reviewHarness.ts) — dispatch loop reference.
- [`validatorRegistry.ts`](../../janumicode_v2/src/lib/review/harness/validatorRegistry.ts) — registry pattern.
- [`finalSynthesisDecision.ts`](../../janumicode_v2/src/lib/review/harness/finalSynthesisDecision.ts) — synthesis decision logic.
- [`domainComplianceReview.ts`](../../janumicode_v2/src/lib/review/domainComplianceReview.ts) — decorrelated reviewer rationale.
