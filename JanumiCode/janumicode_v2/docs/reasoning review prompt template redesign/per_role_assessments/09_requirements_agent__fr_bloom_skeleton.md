# Assessment: requirements_agent / fr_bloom_skeleton (Phase 2.1.1)

**Sample:** `track_c_samples/09_requirements_agent__fr_bloom_skeleton.md`
**Reviewed agent:** `requirements_agent` running `qwen3.5:9b` (16 KB JSON response, ~20 KB thinking chain)
**Reviewer under examination:** `gemma4:e4b` driven by `prompts/cross_cutting/reasoning_review.system.md`
**Reviewer outcome:** `has_concerns: true`, 1 HIGH-severity finding

---

## 1. What this sample reveals

This is the **first time the corpus exercises the requirements agent**, and it does so on the *root bloom*: Pass 1 of 3 (Skeleton) under Phase 2.1. The agent receives the full product handoff (27 user journeys, ~80 entities, 15 workflows, 7 compliance items, 19 vocabulary terms, 4 open questions) and must emit one `user_story` skeleton per accepted journey with exactly **one seed acceptance criterion per FR**. Subsequent passes will enrich (Pass 2) and structurally verify (Pass 3); the saturation/recursive decomposition that the original ChatGPT 5.5 assessment was written against happens at Phase 2.1.* further down the tree.

The relationship to the original assessment matters for validator reuse. That document was written for an *NFR saturation* output where each child carried a `tier`, an `acceptance_criteria[]` array with `measurable_condition` shaped as SQL-or-near-SQL, a `parent_branch_classification`, and a `decomposition_rationale`. Skeleton's contract is shallower: no tier field, no parent classification, no decomposition rationale, and the contract explicitly caps ACs at one per FR with the **seed** measurable condition. So:

- `contract_schema_validator` carries forward, parameter-varied for the `user_stories[] / unreached_journeys[]` shape.
- `grounding_validator` carries forward unchanged in mission; the surface area shifts to traces, role names, persona attributions, and any quantitative claim baked into the seed AC.
- `measurement_adequacy_validator` carries forward but is **down-scoped at this pass**: the seed AC is a placeholder, so adequacy reduces to (a) does the condition test the *description*, and (b) does it avoid fabricating new thresholds. The full "100%-vs-`>0`" coverage-fallacy class belongs to Pass 2 / Pass 3.
- `tier_decomposition_validator` does **not** apply at the skeleton pass — there is no tier in the contract and no decomposition occurs here. (It will return at NFR saturation and at the FR-saturation pass that follows enrichment.)
- `assumption_citation_validator` collapses to a *traceability* check at this pass: there is no surfaced-assumption list in the contract, only `traces_to[]`.
- `reasoning_quality_validator` carries forward unchanged.

The reviewer fired one HIGH finding. As §1b shows, that finding is **partially correct but mis-severitied and topically off-target**: it picks up a permissive ("MAY") clause as if it were mandatory, while leaving four substantive defects unflagged — a description-vs-measurement contradiction on US-001, two fabricated numeric thresholds (US-022 50 ms, US-027 "Top 3"), persona-name drift versus the handoff's `P-*` set, and a thinking-vs-output contradiction (the chain plans US-028/029/030 then drops them silently in the final JSON).

The role-specific implication: skeleton-pass review needs a **handoff coverage audit** that checks the journey-set spine *and* the explicit `unreached_journeys[]` justification path; a **story shape conformance** check that the role / action / outcome triple is non-trivial and persona-grounded; and a **pass-scope discipline** check that prevents the agent from hallucinating Pass-2 measurement specificity into Pass-1 seeds.

### 1a. Defects in the agent's response

#### 1a.1 Description-vs-measurable_condition contradiction in US-001 (HIGH)

US-001 is the first story and sets the pattern for the rest. Its single AC reads:

> ```
> "description": "Property record indexed and visible within 2 minutes",
> "measurable_condition": "POST /properties returns 201 and GET /properties/{id} returns the stored record within 1 second"
> ```

The description says **2 minutes**; the condition asserts **1 second**. These are not the same commitment. The description is faithful to the handoff (`UJ-ONBOARD-PROPERTY` acceptance: "Property record indexed and visible within 2 minutes"), but the condition fabricates a 120× tighter latency. The condition is also a verbatim copy of the *example block in the prompt* (the prompt's own US-001 illustration uses "POST /properties returns 201 and GET /properties/{id} returns the stored record within 1 second"). The agent has copied the exemplar's measurement instead of authoring a seed condition for the actual journey acceptance.

This is the canonical Pass-1 failure mode: a copied exemplar masquerading as a seed. It is also a *grounding* failure — the "1 second" is unsupported by the handoff — and a *measurement adequacy* failure — the condition under-tests the stated description.

#### 1a.2 Fabricated numeric thresholds in seed conditions (HIGH on US-022, MEDIUM on US-027)

US-022's AC for `UJ-ACCESS-LOGS`:

> ```
> "description": "Logs displayed in real-time without delay",
> "measurable_condition": "Log stream latency remains below 50 milliseconds"
> ```

The handoff says "Logs displayed in real-time without delay" — qualitative. The agent has invented "50 milliseconds" out of nothing in the handoff. There is no millisecond budget anywhere in the substrate. (The closest quantitative real-time constraint in the source is `WF-PLATFORM-HEALTH` "every 15 minutes", which is the opposite end of the spectrum.) This is a cleanly-shaped grounding defect: an unsupported numeric threshold embedded as if it were a seed measurement.

US-027's AC for `UJ-BROWSE-VENDORS-AI`:

> ```
> "description": "Recommendations relevant to user context",
> "measurable_condition": "Top 3 recommendations match user property type and trade needs"
> ```

The handoff is silent on cardinality — there is no "Top 3" anywhere in `WF-AI-RECOMMENDATION` or `ENT-AI-RECOMMENDATION`. Inventing the cardinality at Pass 1 silently commits the platform to a UI/UX choice that should be a Pass-2 enrichment decision or an open question.

These belong to the same family as the original assessment's *grounding* defect class (unsupported thresholds), specialised to the seed-AC surface.

#### 1a.3 Thinking-vs-output contradiction: US-028 / US-029 / US-030 planned then silently dropped (MEDIUM)

The reasoning chain explicitly plans three supplemental compliance-seeded FRs:

> "I will add US-028 for COMP-PERSISTENT-DATA (Retention/Archiving). I will add US-029 for COMP-NOTICE (Sending statutory notices). I will add US-030 for COMP-GL-AUDIT (Ledger integrity)."
> "27 from UJs + 3 from Compliance (Persistent Data, Notice, GL-Audit)."
> "I will generate 30 FRs to ensure full coverage and compliance focus."

The final response contains 27 user_stories (US-001 to US-027) and `"unreached_journeys": []`. The compliance FRs the chain decides to add are absent. This is a `reasoning_to_response_faithfulness` defect rather than a "missing required FR" defect — the prompt says supplemental compliance FRs are *allowed* (`MAY`), not *required* (`MUST`) — but the contradiction itself is a reasoning-quality signal: the agent decided to add three items, did not author them, and did not record the reversal.

(The reviewer's lone finding interprets this same gap as a *coverage failure*; see §1b for why that interpretation is wrong on the prompt text.)

#### 1a.4 Persona-name drift vs the handoff's `P-*` registry (LOW–MEDIUM)

The handoff names personas with stable IDs: `P-HOMEOWNER`, `P-TENANT`, `P-INVESTOR`, `P-PROVIDER`, `P-CAM-MANAGER`, `P-BOARD`, `P-FINANCE-OFFICER`, `P-AUDITOR`, `P-ADMIN`. The agent's `role` strings are free-form derivatives:

- `P-CAM-MANAGER` → "CAM-Manager" (US-014–017, 026)
- `P-BOARD` → "Board" (US-018, 019) — drops "Member"
- `P-FINANCE-OFFICER` → "Finance-Officer" (US-020, 021) — adds hyphen
- `P-PROVIDER` → "Provider" (matches handoff display name)

The drift is small but it breaks downstream lookup if Pass 2 / Pass 3 want to join `role` against `P-*`. The prompt's exemplar used "Board Member" (not "Board"), which the agent ignored. This is a `story_shape_conformance` defect at the role-field boundary.

#### 1a.5 Trace sparsity and one questionable trace selection (LOW)

US-002 (Tenant report) traces to `["UJ-REPORT-TENANT-ISSUE", "WF-MR-LIFECYCLE", "ENT-MAINTENANCE-ISSUE-TYPE"]` but omits `ENT-MAINTENANCE-REQUEST`, which is the entity actually instantiated by the journey (`ENT-MAINTENANCE-ISSUE-TYPE` is the *catalog*, not the *record*). US-008 (Investor portfolio) traces `ENT-UNIT` but omits `ENT-PROPERTY`, which is the parent. None of these trace selections reference invented IDs (so the self-heal filter passes), but the substrate-to-story trace integrity is weaker than it should be. This is borderline-LOW; it surfaces as a `source_attribution_grounding` finding when run.

#### 1a.6 Premature measurement specificity in seed ACs (MEDIUM, recurring)

The Pass-1 contract says the seed AC should be "the most essential measurable condition" — a *seed*, not a finished verification. Several conditions over-author for the pass:

- US-007: "Workflow transitions job state to Scheduled within 10 seconds" — names a workflow and an internal state machine.
- US-021: "Ledger entry created and persisted within 2 minutes" — fine, matches description.
- US-024: "Dashboard updates with metrics every 60 seconds maximum" — names a UI surface.
- US-025: "ACL updated and applied to sessions within 1 second" — names ACL/session implementation.

None of these are wrong *grounding-wise*; they are over-committed *for a seed*. The prompt explicitly warns: "Don't burn your attention budget on AC-writing; that's Pass 2's job." The agent does spend attention on AC-writing, and several of those ACs commit Pass-2 detail. A `pass_scope_discipline` validator would flag the recurring pattern; the per-condition severity is LOW–MEDIUM.

#### 1a.7 No vocabulary canonicalisation (LOW)

The prompt requires "Use canonical vocabulary verbatim — if the glossary says 'assessment', don't say 'dues' or 'charge'." The handoff lists `VOC-WORK-ORDER` ("Work Order"), `VOC-SERVICE-CALL`, `VOC-OWNER-PORTAL`, `VOC-TRUST-LEDGER`, `VOC-ASSESSMENT`. The agent's strings ("work order", "ledger", etc.) are mostly aligned with the canonical forms, but the `traces_to[]` arrays do not reference any `VOC-*` ids — even where the action explicitly invokes one (US-005's "work order" → no `VOC-WORK-ORDER` trace; US-021's "Ledger" → no `VOC-TRUST-LEDGER` trace). Whether `VOC-*` trace inclusion is required is not literally specified, but since `VOC-*` is on the valid-prefix list, the omission weakens the spine. LOW.

### 1b. Analysis of the reviewer's 1 finding

The reviewer's HIGH finding:

> "Failure to include supplemental, non-journey-derived compliance requirements. The prompt explicitly encourages (and implies necessity for) creating Functional Requirements (FRs) seeded by compliance items… By omitting dedicated FRs for critical compliance constraints like General Ledger auditing, statutory notice enforcement, and explicit data retention mechanisms, the output fails to meet the full scope of the 'Coverage contract'…"

**Verdict:** *partial hit, wrong severity, wrong root cause.*

The prompt language on supplemental compliance FRs is permissive, not mandatory:

> "In addition, you **MAY** produce FRs seeded primarily from compliance items, entities, or workflows that don't trace to a specific user journey… These are allowed but supplemental; **the journey-derived FRs are the spine.**"

The reviewer escalates `MAY` to `MUST` ("implies necessity for", "fails to meet the full scope of the 'Coverage contract'"). The Coverage Contract elsewhere in the prompt is explicitly defined as journey-side: "Every accepted user journey MUST be the seed of at least one FR." The agent satisfied that contract in full (27 / 27 journeys covered, `unreached_journeys: []`).

The finding does, however, partially intersect with a real defect: the agent's reasoning chain *did* commit to adding US-028 / US-029 / US-030 and *did* drop them. So the reviewer's finding correctly notices that *something* is missing, but mis-attributes the missing-ness to a contractual obligation rather than to the agent's own broken commitment. The correct framing is **§1a.3** (`reasoning_to_response_faithfulness`), not "coverage contract failure". Severity should be MEDIUM (recoverable, optional artefact, but a genuine reasoning-vs-output gap), not HIGH (production-blocking).

### 1c. What the reviewer missed

Against a 16 KB output, the reviewer logged exactly one finding and aimed it at the lowest-impact gap. Specifically missed:

1. **US-001 description-vs-measurement contradiction** (§1a.1) — the most material defect in the response. A 2-minute description with a 1-second condition is a textbook measurement-adequacy / internal-consistency failure that any deterministic check would catch.
2. **US-022 fabricated 50 ms threshold** (§1a.2) — straight-line grounding failure of the kind the original ChatGPT 5.5 assessment specifically targeted.
3. **US-027 fabricated "Top 3" cardinality** (§1a.2) — same class.
4. **The thinking-vs-output gap on US-028/029/030** (§1a.3) — what the reviewer's finding is *actually about*, but wasn't framed correctly.
5. **Persona-name drift from `P-*`** (§1a.4) — load-bearing for downstream Pass-2 / Pass-3 joins.
6. **Pass-scope discipline drift** (§1a.6) — the prompt warns the agent twice not to over-author; several ACs ignore the warning.

The pattern matches the trend across samples 03, 05, 06, 07, 08: a single Gemma-class reviewer with a broad scope produces one moderately-confident finding and silently misses the higher-impact, narrower-scope defects. The remediation pattern — narrow-scoped validators with positive-mission framing — is by now standard in this corpus.

---

## 2. Diagnosis

The skeleton pass has a *characteristic* failure surface that is distinct from both bloom-class and synthesis-class:

| Failure class | Bloom (samples 05–06) | Synthesis (07–08) | Skeleton (this) |
|---|---|---|---|
| Coverage | additive: did all sources get bloomed? | subtractive: did all inputs land in the compressed output? | spine: did every UJ become a seed FR (or get explicitly excused)? |
| Fabrication | new entities/journeys not in source | new claims in narrative prose | new thresholds in seed ACs; copied exemplar values |
| Scope discipline | tier confusion | over-claiming completeness | over-authoring ACs (Pass-2 work in Pass-1 output) |
| Trace integrity | id reference correctness | persona mention completeness | `traces_to[]` substrate coverage; persona-id alignment |

Skeleton sits at the boundary where the agent moves from *substrate* (journeys, entities, workflows) to *requirements*. The dominant risks are (a) silently dropping substrate items the spine should have covered, and (b) silently inflating seed conditions with Pass-2 specificity that has no substrate support. The single-pass Gemma reviewer cannot reliably attend to both axes at once.

The validator pipeline below allocates one narrow validator per failure class, with deterministic checks where possible (story-structure, handoff coverage on the spine) and LLM checks where unavoidable (story-shape, fabrication-in-condition).

---

## 3. Recommended validator pipeline for this role

Pipeline order (deterministic first, then narrow LLM, synthesis last):

```
1. contract_schema_skeleton         (deterministic; parameter-varied from sample 02/06/08)
2. story_structural_completeness    (deterministic; NEW for skeleton pass)
3. handoff_coverage_audit           (deterministic; NEW for skeleton pass)
4. source_attribution_grounding     (LLM; reused from sample 03/05, parameter-varied)
5. story_shape_conformance          (LLM; NEW for skeleton pass)
6. pass_scope_discipline            (LLM; NEW for skeleton pass)
7. grounding_validator              (LLM; reused from original assessment, narrowed to seed-AC + role/action/outcome surface)
8. measurement_adequacy_validator   (LLM; reused from original, narrowed to "description ↔ condition consistency" only)
9. assumption_citation_validator    (LLM; reused from original, collapsed to traceability scope at this pass)
10. reasoning_to_response_faithfulness (LLM; reused from sample 03/05/07/08)
11. open_question_vs_decided        (LLM; reused from sample 02/05/08)
12. reasoning_quality_validator     (LLM; reused from original)
13. final_synthesis                 (LLM; reused unchanged)
```

**Reuse summary:**
- Exact reuse: `reasoning_quality_validator`, `final_synthesis`, `open_question_vs_decided`, `reasoning_to_response_faithfulness`.
- Parameter-varied reuse: `contract_schema_skeleton` (from `contract_schema_*` family), `grounding_validator` (narrowed surface), `measurement_adequacy_validator` (narrowed scope to consistency-only), `assumption_citation_validator` (collapsed to trace-only), `source_attribution_grounding` (skeleton's seed-vs-substrate variant).
- Genuinely new at skeleton: `story_structural_completeness`, `handoff_coverage_audit`, `story_shape_conformance`, `pass_scope_discipline`.
- Original-assessment validators that **do not apply at skeleton**: `tier_decomposition_validator` (no tier field; no decomposition at this pass — re-engages at FR-saturation and NFR-saturation passes only).

---

## 4. Validator prompt templates

All LLM validators inherit the **revised positive-mission shared envelope** documented in `redesign recommendations - 1.md` §"Revised shared review envelope". Only the role-specific bodies are reproduced below.

### 4.1 `contract_schema_skeleton` (deterministic)

Implemented in code, not LLM. Pseudocode contract:

```
ASSERT response is valid JSON
ASSERT top-level keys ⊆ {"user_stories", "unreached_journeys"} and both present
ASSERT user_stories is array, length ≥ 1
ASSERT unreached_journeys is array (possibly empty)
FOR each story s in user_stories:
  ASSERT s.id matches /^US-\d{3}$/
  ASSERT ids are contiguous from US-001
  ASSERT no duplicate s.id
  ASSERT s.role, s.action, s.outcome are non-empty strings
  ASSERT s.priority ∈ {"critical","high","medium","low"}
  ASSERT s.traces_to is non-empty array of strings
  ASSERT every trace id matches /^(UJ|ENT|WF|COMP|VOC|OPEN|Q)-/
  ASSERT every trace id appears verbatim in handoff substrate set
  ASSERT s.acceptance_criteria has length == 1
  ASSERT s.acceptance_criteria[0].id matches /^AC-\d{3}$/
  ASSERT s.acceptance_criteria[0].description, .measurable_condition non-empty
FOR each entry u in unreached_journeys:
  ASSERT u.journey_id is a valid UJ-* id from substrate
  ASSERT u.reason is non-empty string of length ≥ 20
ASSERT no markdown fences, no prose before "{", no prose after "}"
```

Severity rule: any failure ⇒ HIGH (the verifier in Pass 3 will reject).

### 4.2 `story_structural_completeness` (deterministic)

Stricter content-completeness checks beyond the schema:

```
FOR each story s:
  ASSERT len(s.role) ≥ 3 and not in {"User", "Actor", "Person"}
  ASSERT len(s.action) ≥ 12 and contains a verb (heuristic: first token ends in s/ed/e/d/y/t or matches verb whitelist)
  ASSERT len(s.outcome) ≥ 12
  ASSERT s.outcome does not equal s.action (semantic copy-paste check)
  ASSERT s.acceptance_criteria[0].description and .measurable_condition differ by > 30% Levenshtein
  ASSERT s.role token matches some persona id in handoff (P-* set), modulo case/punct
```

Severity rule: stub-shape failures ⇒ MEDIUM; persona-id-mismatch ⇒ LOW; outcome=action duplication ⇒ MEDIUM.

### 4.3 `handoff_coverage_audit` (deterministic)

```
LET UJ_set = {all UJ-* ids in handoff}
LET covered = {trace_id ∈ s.traces_to : s ∈ user_stories, trace_id starts with "UJ-"}
LET excused = {u.journey_id : u ∈ unreached_journeys}
ASSERT UJ_set ⊆ (covered ∪ excused)
LET orphans = UJ_set \ (covered ∪ excused)
IF orphans non-empty: emit HIGH finding listing orphan ids

# Also detect inverse: a UJ excused as unreached but also traced
LET both = covered ∩ excused
IF both non-empty: emit HIGH finding (contradictory disposition)

# And detect supplemental compliance traces (informational, not a defect)
LET comp_only = {s : s ∈ user_stories, s.traces_to has no UJ-* element}
EMIT INFO with comp_only count (helps reviewer spot supplemental FRs)
```

Severity rule: any orphan UJ ⇒ HIGH; contradictory disposition ⇒ HIGH; comp_only is informational only.

### 4.4 `source_attribution_grounding` (LLM, reused from sample 03/05)

```
[MISSION]
Verify that every story in user_stories[] is anchored to substrate items
(UJ/ENT/WF/COMP/VOC/Q ids) that the story actually uses.

[INSPECT]
For each story, compare its role / action / outcome / measurable_condition
against its traces_to[] array.

A trace is well-attributed when:
- the trace id appears in the supplied handoff substrate, AND
- the substrate item the id resolves to is genuinely invoked by the story
  (the entity the story creates/reads, the workflow it triggers, the
  compliance constraint it satisfies, the journey it seeds).

A trace is poorly attributed when:
- the substrate item is tangential (e.g., tracing ENT-MAINTENANCE-ISSUE-TYPE
  for a journey that creates an ENT-MAINTENANCE-REQUEST instance), or
- a load-bearing substrate item that the story clearly invokes is missing
  from traces_to[] (e.g., the story names a "work order" but does not
  trace VOC-WORK-ORDER or ENT-WORK-ORDER), or
- the trace is technically valid but does not contribute to verification.

[BOUNDARY]
JSON schema, story-shape, and measurement adequacy belong to other validators.
Do not flag them here unless they are the cause of an attribution defect.

[FINDING SHAPE]
{ severity, type: "missing_trace|tangential_trace|wrong_substrate_item",
  storyId, traceId (or "<missing>"), substrateItemExpected,
  whyItMatters, recommendation }
```

Severity rule: missing load-bearing trace ⇒ MEDIUM; tangential-only ⇒ LOW; wrong substrate ⇒ MEDIUM.

### 4.5 `story_shape_conformance` (LLM, NEW)

```
[MISSION]
Verify that each user story states a real user-facing capability in the
role / action / outcome triple that the skeleton contract requires.

[INSPECT]
For each story, decide whether:
- role names a real persona aligned to a P-* id from the handoff persona set
- action is an observable behavior the persona performs (verb phrase,
  not aspirational language and not a system commitment phrased as a
  user action)
- outcome states a downstream value or post-condition that justifies
  the action (not a paraphrase of the action)

A well-shaped story reads as a coherent "[role] does [action] so that
[outcome]" sentence even when the prompt's literal output schema uses
separate fields rather than the canonical "As a … I want … so that …"
template.

[FAILURE PATTERNS]
- role drift (e.g., "Board" instead of the handoff's "Board Member")
- aspirational action ("ensure that …", "be confident that …")
- system commitment masquerading as user action ("system records …",
  "platform syncs …" placed in a story whose role is a human persona)
- outcome that restates the action with synonyms
- outcome that names an internal mechanism rather than user value

[BOUNDARY]
Trace integrity, AC quality, and JSON schema belong to other validators.

[FINDING SHAPE]
{ severity, type: "role_drift|aspirational_action|outcome_action_duplicate|
                   system_commitment_as_user_action|implementation_in_outcome",
  storyId, span (quoted), recommendation }
```

Severity rule: role drift ⇒ LOW; aspirational/system-commitment ⇒ MEDIUM; outcome=action ⇒ MEDIUM.

### 4.6 `pass_scope_discipline` (LLM, NEW)

```
[MISSION]
Verify that the skeleton output stays at Pass-1 scope — seed-only ACs,
no Pass-2 enrichment, no Pass-3 verifier work.

[INSPECT]
For each story.acceptance_criteria[0]:
- A seed AC states the most essential measurable condition for the
  description in plain language. It is allowed to reference timing
  thresholds, status transitions, and persistence checks already named
  in the journey acceptance line.
- A seed AC is over-authored when it embeds details that belong to
  Pass-2 enrichment: full SQL, multi-clause boolean conditions, named
  internal subsystems (ACLs, queues, PDF generators), latency budgets
  finer-grained than the description, or specific HTTP status codes
  not justified by the substrate.

[INSPECT ALSO]
- Whether the acceptance_criteria array length is exactly 1 (contract).
- Whether description and measurable_condition restate the same
  threshold consistently (description "within 2 minutes" with condition
  "within 1 second" is a contradiction even before any other check).

[BOUNDARY]
Grounding of new thresholds belongs to grounding_validator. Internal
description-vs-condition contradictions belong here AND to
measurement_adequacy_validator; report them in both validators since
they are the same defect viewed from different angles.

[FINDING SHAPE]
{ severity, type: "over_authored_ac|description_condition_mismatch|
                   pass2_detail_in_seed|premature_implementation_binding",
  storyId, acId, descriptionSpan, conditionSpan, recommendation }
```

Severity rule: description-condition mismatch ⇒ HIGH; pass-2 detail ⇒ MEDIUM; premature implementation binding ⇒ LOW–MEDIUM.

### 4.7 `grounding_validator` (LLM, reused, narrowed surface)

Same template as the original assessment §2, with `[CLAIMS TO CHECK]` replaced by:

```
At skeleton pass, pay special attention to:
- numeric thresholds in measurable_condition that are not in the
  journey acceptance line, the workflow description, or any compliance item
- cardinalities ("Top 3", "first N", "at least M") not present in substrate
- HTTP status codes, endpoint paths, or status-machine transition names
  not present in substrate
- persona names that introduce roles not in the P-* set
- vocabulary that overrides VOC-* canonical forms (e.g., "dues" instead
  of "assessment")
```

Severity rule: unsupported numeric threshold in a condition ⇒ HIGH; unsupported endpoint or status code ⇒ MEDIUM; persona-name drift ⇒ LOW (also caught by story_shape_conformance).

### 4.8 `measurement_adequacy_validator` (LLM, reused, scope-narrowed)

Original template with `[WHAT TO CHECK]` reduced for skeleton:

```
At skeleton pass, only flag:
1. description-vs-condition contradictions on the SAME story
   (e.g., "within 2 minutes" / "within 1 second")
2. conditions that test something other than what the description states
   ("description: record persists", "condition: notification sent")
3. trivially-tautological conditions ("system works as expected")

Do NOT flag at this pass:
- count-equality fallacies, null-handling gaps, set-equality, uniqueness
  shapes, referential integrity — those belong to Pass-2 measurement
  adequacy and to the NFR saturation reviewer, not here.
```

Severity rule: contradiction ⇒ HIGH; off-target condition ⇒ MEDIUM; tautology ⇒ MEDIUM.

### 4.9 `assumption_citation_validator` (LLM, reused, collapsed to trace-only)

Skeleton has no `surfaced_assumptions[]` field, so the original validator collapses to its citation half. Mission becomes: "verify every `traces_to[]` entry resolves to a real handoff id and is non-duplicative within a story." Severity rule unchanged.

### 4.10 `reasoning_to_response_faithfulness` (LLM, reused)

```
[MISSION]
Detect contradictions between the agent's thinking chain and its final
response.

[INSPECT]
- The agent commits to producing N items in the chain; the response has
  M ≠ N. (US-028/029/030 case in this sample.)
- The agent rejects an option in the chain but the response uses it.
- The agent decides on a value (number, name, persona) but the response
  uses a different one.
- The chain catches a defect ("Wait, that's wrong"), describes a fix,
  and the response does not apply the fix.

[FINDING SHAPE]
{ severity, type: "commitment_dropped|reversed_decision|missing_fix",
  chainSpan, responseSpan, whyItMatters, recommendation }
```

Severity rule: dropped commitment that affects coverage ⇒ MEDIUM (HIGH if coverage spine is broken); reversed decision affecting a numeric value ⇒ MEDIUM; missing fix that the chain explicitly noted ⇒ MEDIUM.

### 4.11 `open_question_vs_decided` (LLM, reused)

Standard template. At skeleton pass: an open question (Q-*) referenced as a `traces_to[]` entry must not be silently treated as resolved by the seed AC. (E.g., Q-3 "private vs public listings" cannot be embedded as a default behavior in US-027.) Severity unchanged.

### 4.12 `reasoning_quality_validator` (LLM, reused unchanged)

Original template. At skeleton pass, expect this validator to repeat the higher-leverage findings raised by the narrow validators above; it should focus on the *pattern* (e.g., "agent copied prompt exemplar values into US-001, weakening the entire seed-AC discipline") rather than per-defect repeats.

### 4.13 `final_synthesis` (LLM, reused unchanged)

Original template. Decision policy unchanged.

---

## 5. Conditional dispatch and integration

**Always-run (deterministic, cheap):**
- `contract_schema_skeleton`
- `story_structural_completeness`
- `handoff_coverage_audit`

If any of the three fires HIGH, short-circuit to `final_synthesis` (no benefit running LLM validators against a structurally broken response).

**Always-run (LLM, cheap):**
- `source_attribution_grounding`
- `story_shape_conformance`
- `pass_scope_discipline`
- `reasoning_to_response_faithfulness`

These are the four narrow LLM validators that the corpus has consistently shown a single broad reviewer cannot cover in one pass.

**Conditional:**
- `grounding_validator` runs only if the response contains numeric thresholds, cardinalities, or named endpoints in any seed AC. A cheap regex pre-filter (`/\d+\s*(ms|seconds?|minutes?|hours?|%)/i`, `/Top\s+\d+/i`, `/HTTP\s+\d{3}/i`, `/POST|GET|PUT|DELETE/`) decides the dispatch.
- `measurement_adequacy_validator` runs only if `pass_scope_discipline` reports a description-vs-condition mismatch *or* if any seed AC contains comparator-shaped tokens (`<`, `>`, `=`, `match`, `equal`).
- `open_question_vs_decided` runs only if any `traces_to[]` references a `Q-*` or `OPEN-*` id.

**Synthesis:**
- `final_synthesis` always last. Decision policy: any HIGH from `contract_schema_skeleton`, `handoff_coverage_audit`, `pass_scope_discipline` (description-condition mismatch class), or `grounding_validator` (unsupported threshold class) ⇒ QUARANTINE. MEDIUM-only ⇒ REVISE. Reasoning-faithfulness MEDIUM alone ⇒ ACCEPT_WITH_NOTES + rerun recommendation flagging the specific dropped commitment.

**Cost note:** the deterministic prefix catches roughly half of the defect taxonomy at near-zero cost. The four always-run LLM validators are narrow and short-context (a single story plus the handoff substrate); each can run on the same Gemma-class model in serial without exceeding the current per-phase budget.

---

## 6. Notes and open questions

1. **Tier model deferred.** Skeleton has no `tier` field and no decomposition. The `tier_decomposition_validator` from the original ChatGPT 5.5 assessment will re-engage at FR-saturation (sample slot reserved by the recursive decomposition flow) and at NFR saturation. At those passes the validator's input set will look much more like the original NFR sample it was written for.

2. **Pass-2 (ac-enrichment) overlap.** Several validators here (`measurement_adequacy_validator`, `grounding_validator`, `pass_scope_discipline`) will need parameter-varied siblings at Pass 2 with *expanded* scope: the count-equality / set-equality / null-handling battery from the original assessment becomes load-bearing once Pass-2 produces full AC arrays. The seed-only narrowing in §4.6 / §4.8 is a deliberate scope contraction for Pass 1 only.

3. **Pass-3 (deterministic verifier) overlap with `handoff_coverage_audit`.** The Pass-3 verifier described in the prompt is functionally a deterministic coverage check. The recommendation here is to **run `handoff_coverage_audit` as Pass-1 advisory** rather than wait for Pass-3 — catching coverage failures one pass earlier is strictly cheaper.

4. **Vocabulary canonicalisation policy.** The prompt requires verbatim `VOC-*` use but does not require `VOC-*` ids in `traces_to[]`. If product policy wants `VOC-*` traceability enforced, `handoff_coverage_audit` should be extended with a "every story whose action/outcome mentions a VOC-* synonym must include the VOC-* id in traces_to" rule. Flagged as policy decision rather than defect.

5. **Persona-id alignment.** §4.2's persona-match heuristic against the `P-*` set should be made authoritative — i.e., `role` should be a free-form display name *and* a `personaId` field should be added to the contract. Not in scope for this assessment; flagged as a contract-evolution proposal for Wave 8.

6. **Reasoning-vs-response detection cost.** §4.10 `reasoning_to_response_faithfulness` is the validator most likely to exceed context budget, because it requires both the full thinking chain (~20 KB here) and the response (~16 KB). Recommend running it with reasoning-chain summarisation if context becomes a problem, with the caveat that summarisation can erase exactly the kind of "I will add US-028" commitment that this validator is meant to catch.

7. **Exemplar-leakage detection.** The US-001 defect (§1a.1) is a specific pattern where the agent copies values from the prompt's own exemplar block into its response. A cheap deterministic check would compute Levenshtein similarity between every `measurable_condition` in the response and every `measurable_condition` in the prompt's exemplar JSON; a similarity > 0.9 flags exemplar leakage. Worth a follow-up implementation note for the deterministic battery.
