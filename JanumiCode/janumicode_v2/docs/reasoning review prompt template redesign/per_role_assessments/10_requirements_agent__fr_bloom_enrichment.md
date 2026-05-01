# Assessment: requirements_agent / fr_bloom_enrichment (Phase 2.1.2)

**Sample:** `track_c_samples/10_requirements_agent__fr_bloom_enrichment.md`
**Reviewed agent:** `requirements_agent` running `qwen3.5:9b` (1,432-byte JSON response, ~60 KB thinking chain)
**Reviewer under examination:** `gemma4:e4b` driven by `prompts/cross_cutting/reasoning_review.system.md`
**Reviewer outcome:** `has_concerns: false`, 0 findings

---

## 1. What this sample reveals

This is **Pass 2 of 3 (Acceptance-Criteria Enrichment)** for Sub-Phase 2.1, the pass that takes a single FR skeleton — here `US-014` ("CAM-Manager reviews and approves a new vendor for the community") — and inflates its single seed acceptance criterion into a 3–7-item measurable list while echoing every other field unchanged. Sample 09 (the skeleton pass) deferred the heavyweight content of the original ChatGPT 5.5 assessment to here, on the explicit grounds that "the count-equality / set-equality / null-handling battery from the original assessment becomes load-bearing once Pass-2 produces full AC arrays." That handoff falls due now: enrichment is the surface where `measurable_condition` strings actually exist in quantity, where new thresholds, endpoints, status codes, and error names get coined, and where the *description ↔ condition* discipline that the original assessment was built around is the dominant reliability question.

Two things follow for the validator pipeline:

- **Some skeleton validators deactivate.** `story_structural_completeness`, `handoff_coverage_audit`, and `story_shape_conformance` were the spine checks at Pass 1; at Pass 2 they have no work — the agent is contractually forbidden from rewriting `id / role / action / outcome / priority / traces_to`, so a single deterministic equality check ("echoed fields are byte-identical to the input skeleton") replaces the entire skeleton-shape battery.
- **The original assessment's `measurement_adequacy_validator` engages at full strength.** Sample 09 narrowed it to "description-vs-condition consistency only"; here the count-equality fallacy, weak-proxy, set-equality, null/orphan, missing-uniqueness, and missing-temporal-window classes all fire on real surface area. This is the role/sub-phase the original ChatGPT 5.5 document was, in effect, written for.

A 1,432-byte response is small enough to read end-to-end, and at that size every defect is visible at a glance. The reviewer logged zero findings while the response carries at least four substantive defects — including two that the original assessment's `measurement_adequacy_validator` would catch verbatim, one fabricated HTTP/error-code pair, and one outright skeleton-scope-drift AC.

### 1a. Defects in the agent's response

The five ACs in the response (AC-014…AC-018) are:

```
AC-014  description: "Approval logged within 1 hour of review"
        condition:   "An audit log entry with action='vendor.approve' is
                      persisted where created_at <= review_timestamp + 1 hour"

AC-015  description: "Vendor status transitions to 'Vetted' upon approval"
        condition:   "GET /vendor/{id} returns HTTP 200 and status='Vetted'"

AC-016  description: "Vetting failure prevents status update"
        condition:   "POST /vendor/{id}/approve returns HTTP 409 Conflict
                      with error code 'COMPLIANCE_FAILURE' and vendor status
                      remains 'Pending'"

AC-017  description: "Vetting decision record is created"
        condition:   "GET /vetting-decisions/{id} returns record with
                      decision_type='approved' and vendor_id"

AC-018  description: "Vetted vendor is searchable"
        condition:   "GET /vendors?status='Vetted' returns a list including
                      the newly approved vendor"
```

#### 1a.1 Existence-as-coverage fallacy on AC-014 (HIGH, measurement adequacy)

The seed description requires *the* approval to be logged within 1 hour of *the* review. The condition asserts the existence of *an* audit-log row whose `created_at` is no later than `review_timestamp + 1 hour`. There is no predicate binding the row to the specific approval under test (no `vendor_id`, no `actor_id`, no `decision_id`), and no lower bound (`created_at >= review_timestamp`) — a log entry written *before* the review would still satisfy the inequality. The condition can pass on a happy path while the actual approval went unlogged, which is the canonical "happy-path passes / requirement fails" pattern the original assessment defines as HIGH.

The minimum repair shape is:

```
EXISTS (audit_log a WHERE a.action='vendor.approve'
                     AND a.vendor_id = <subject>.vendor_id
                     AND a.actor_id  = <subject>.approver_id
                     AND a.created_at BETWEEN review_timestamp
                                          AND review_timestamp + interval '1 hour')
```

This is the same defect class as the original assessment's "QSA linkage check is also logically weak" finding — count-or-existence equality without referential binding.

#### 1a.2 State-postcondition with no transition check on AC-015 (MEDIUM, measurement adequacy)

The description promises a *transition* ("transitions to 'Vetted' upon approval"). The condition only inspects the post-state (`status='Vetted'` after a GET). A vendor that was already 'Vetted' before the test would satisfy the condition without any transition having occurred; an approval flow that silently no-ops on an already-vetted record would also pass. The condition omits the *before-state* and the *causal step*. A minimum repair adds a precondition assertion (`status='Pending'` or `status != 'Vetted'` before the approve call) and orders it relative to the POST.

This is also a `measurement_adequacy_validator` HIGH/MEDIUM under the "existence requirement confused with coverage requirement" pattern in the original — here, "post-state requirement confused with transition requirement."

#### 1a.3 Fabricated HTTP status code, error name, and prior-state value on AC-016 (HIGH, grounding + measurement adequacy)

AC-016 invents three distinct ungrounded entities:

1. **HTTP `409 Conflict`** — substrate (the three traced items `UJ-APPROVE-VENDOR`, `WF-VENDOR-VETTING`, `ENT-VETTING-DECISION`) names no HTTP transport at all; the choice of `409` over `403`, `422`, or `400` is unjustified by anything in the input.
2. **Error code `'COMPLIANCE_FAILURE'`** — a coined identifier; the substrate explicitly lists `(none)` for Traced Compliance Items, so the only "compliance" anchor is the prose phrase "Compliance Verification" inside `WF-VENDOR-VETTING`'s description, which does not name any error code.
3. **Vendor status `'Pending'` as the rejection-path post-state** — the skeleton's `outcome` only names `'Vetted'`; nothing in substrate says the prior state is `'Pending'`. The agent's own thinking chain admits this verbatim: *"`Pending` is not in the vocabulary list … I'll use `'Pending'` as it is standard."* That is a textbook unsupported-assumption-as-binding-commitment.

All three are grounding defects under the original assessment's §2 scope. The first two are also `measurement_adequacy_validator` defects: the condition can be passed by a system that returns *any* error on failure, including ones that violate user expectation, because the AC has fabricated the contract.

#### 1a.4 Field-existence proxy with no value comparator on AC-017 (MEDIUM, measurement adequacy)

The condition `returns record with decision_type='approved' and vendor_id` checks one bound value (`decision_type='approved'`) and the *presence* of a `vendor_id` column with no value to compare against. Any record with a non-null `vendor_id` of *any* value — including the wrong one — satisfies the assertion. The repair is an equality on the actual subject vendor and ideally on the approving CAM-Manager's id, both of which the substrate (`ENT-VETTING-DECISION` plus the `CAM-Manager` role) actually entails.

This is a "weak proxy" finding under the original assessment's enumeration.

Additionally, `GET /vetting-decisions/{id}` is ambiguous: which `{id}`? Vendor id? Decision id? Approval id? The condition is not executable without naming the join key — that is a `non_executable_condition` under the original taxonomy.

#### 1a.5 Skeleton-scope drift on AC-018 (MEDIUM, drift + grounding)

AC-018 introduces a *vendor search/list capability* (`GET /vendors?status='Vetted'`) that has no anchor in the skeleton's `outcome` ("Vendor status updated to 'Vetted' for community use") nor in any of the three traced substrate items. The skeleton's outcome is about *the status update itself*; making vendors searchable by status is a separable capability that should belong to its own user story (likely `UJ-BROWSE-VENDORS-AI` or similar), not to `US-014`. This is the enrichment-specific failure mode: the agent over-authors and silently widens the FR's scope.

Under the original taxonomy this also splits into a grounding defect (the listing endpoint is invented) and a "scope creep beyond skeleton" finding that is new to Pass 2.

#### 1a.6 Cosmetic inconsistencies surfacing reasoning sloppiness (LOW)

- **Pluralisation drift:** AC-015/016 use `/vendor/{id}` (singular); AC-018 uses `/vendors?status=...` (plural). Trivial in isolation but consistent endpoint shaping is the kind of thing a downstream contract-test generator depends on.
- **Embedded-quote convention drift:** the prompt's "use single quotes for embedded phrases" rule is followed by AC-018 (`status='Vetted'`) but only partially elsewhere — AC-014's condition references `created_at <= review_timestamp + 1 hour` with no quoting on either symbolic name (these are unquoted identifiers, which is *fine*, but the inconsistency reflects the chain's confusion documented across ~60 KB of "Wait, checking single quotes…" loops).
- **Reasoning-chain pathology:** the thinking chain is 59,683 characters for a 1,432-byte response — a 41× ratio. The chain consists almost entirely of recursive "Wait, checking …" fragments restating the prompt's constraints. This is a `reasoning_quality_validator` finding under "shortcut-taking / over-cleverness / unsupported confidence" — the agent self-assured into looping rather than committing — but it is not a defect of the *response*, only of the cost profile.

#### 1a.7 No exemplar leakage (negative finding)

Substring-checking the response against the prompt's exemplar block (US-001, AC-001..AC-003) shows no leakage of exemplar values: no `POST /properties`, no "within 1 second", no `ADDRESS_REQUIRED`, no `/properties/{id}/photos`. The exemplar's *shape* (REST endpoint + state assertion) carried over, which is intended; the *values* did not. This is the rare clean axis on this response and worth recording explicitly because sample 09's US-001 defect was exemplar leakage; the fix appears to have stuck across the pass boundary.

### 1b. Reviewer performance

`hasConcerns: false`, 0 findings, with the prose summary: *"The agent successfully adhered to all complex constraints, including maintaining the original structure, preserving the seed AC ID, and generating measurable criteria that cover happy paths, failure modes, and system outcomes. The use of single quotes for embedded strings within the JSON structure is correct, and the reasoning is sound."*

Calibration verdict: **mis-calibrated; misses the entire measurement-adequacy axis.**

The reviewer's praise focuses on three structural axes that a deterministic schema validator would have already covered (echoed fields, AC ID continuity, single-quote convention) and one stylistic axis (coverage breadth) that confuses *AC count and topic spread* with *measurement adequacy*. None of §1a.1, §1a.2, §1a.3, §1a.4, or §1a.5 is mentioned. This is the same pattern observed in samples 02–09: a Gemma-class single-pass reviewer with broad scope produces a confidently empty review when the defects are semantic-verification-shaped rather than structural.

The pattern is now strong enough to be load-bearing for the pipeline design: **the broad reasoning_review prompt cannot reliably attend to measurement-adequacy defects in `measurable_condition` strings**. It must be replaced at this sub-phase by a narrow `measurement_adequacy_validator` running the original ChatGPT 5.5 template verbatim.

### 1c. What carries forward from sample 09 and what newly engages

| Validator | Skeleton (sample 09) | Enrichment (this sample) |
|---|---|---|
| `contract_schema_*` | active (skeleton shape) | active (enrichment shape — different schema) |
| `story_structural_completeness` | active | **deactivated** (echo-only on those fields) |
| `handoff_coverage_audit` | active | **deactivated** (single FR input) |
| `story_shape_conformance` | active | **deactivated** (echo-only) |
| `pass_scope_discipline` | "Pass-1 only seed AC" scope | "Pass-2 only — no NFRs, no implementation" scope |
| `grounding_validator` | seed-AC surface | full surface: every AC's condition (load-bearing here) |
| `measurement_adequacy_validator` | narrowed to consistency-only | **full original scope re-engages** |
| `assumption_citation_validator` | trace-only (no surfaced_assumptions) | trace-only (still no surfaced_assumptions) |
| `reasoning_to_response_faithfulness` | active | active |
| `open_question_vs_decided` | active | active |
| `reasoning_quality_validator` | active | active |
| `tier_decomposition_validator` | inactive | inactive (re-engages at FR-saturation / NFR-saturation) |
| `final_synthesis` | active | active |

New at enrichment:

- `enrichment_echo_invariance` (deterministic — replaces three skeleton validators)
- `ac_count_discipline` (deterministic)
- `exemplar_leakage_detector` (deterministic)
- `threshold_grounding_audit` (LLM, narrow)
- `measurable_condition_executability` (LLM, narrow — partial overlap with measurement adequacy)
- `skeleton_drift_audit` (LLM)

---

## 2. Diagnosis

Enrichment's failure surface is genuinely different from skeleton's:

| Axis | Skeleton | Enrichment |
|---|---|---|
| Scope | spine: did every UJ become an FR? | depth: does each AC verify what it promises? |
| Fabrication | thresholds in single seed conditions | endpoints, status codes, error names, sibling status values across N conditions |
| Drift | persona / role drift | scope drift past the skeleton's outcome |
| Reasoning | thinking ↔ response faithfulness on FR count | thinking ↔ response on AC count and on dropped repair commitments |
| Measurement | description ↔ condition contradiction | full measurement-adequacy battery (existence, transition, weak proxy, executability) |

The dominant Pass-2 risk is **the verifier-as-decoration failure mode**: an AC whose `measurable_condition` is *shaped like* an assertion (uses HTTP verbs, comparators, `=` predicates) but does not actually verify the description. AC-014 and AC-017 in this sample are textbook examples. A single broad reviewer counts these as "measurable" because they look like SQL/REST; only a validator that reads the description and the condition *together* and asks "could the condition pass while the description's commitment is false?" catches them. That is precisely the mission of the original ChatGPT 5.5 `measurement_adequacy_validator`, and it must not be paraphrased away at this pass.

The pipeline below restores the original validator at full scope, retires the three skeleton-shape validators that have no work to do, and adds four narrow enrichment-specific validators (count discipline, echo invariance, exemplar leakage, skeleton drift) that the corpus needs for Pass-2 coverage but that did not exist at Pass-1.

---

## 3. Recommended validator pipeline for this role

Pipeline order (deterministic first, then narrow LLM, synthesis last):

```
1.  contract_schema_enrichment        (deterministic; parameter-varied from skeleton)
2.  enrichment_echo_invariance        (deterministic; NEW for enrichment)
3.  ac_count_discipline               (deterministic; NEW for enrichment)
4.  exemplar_leakage_detector         (deterministic; NEW for enrichment)
5.  source_attribution_grounding      (LLM; reused, scope-narrowed to AC anchors)
6.  threshold_grounding_audit         (LLM; NEW — specialisation of grounding for numerics/cardinalities)
7.  grounding_validator               (LLM; reused from original at full scope — endpoints, codes, error names, sibling statuses)
8.  measurement_adequacy_validator    (LLM; reused from original at FULL ORIGINAL SCOPE)
9.  measurable_condition_executability (LLM; NEW — narrow check per AC for assert-ability)
10. skeleton_drift_audit              (LLM; NEW for enrichment)
11. pass_scope_discipline             (LLM; reused, parameter-varied — Pass-2 boundaries)
12. assumption_citation_validator     (LLM; reused, collapsed to trace-only)
13. reasoning_to_response_faithfulness (LLM; reused)
14. open_question_vs_decided          (LLM; reused)
15. reasoning_quality_validator       (LLM; reused unchanged)
16. final_synthesis                   (LLM; reused unchanged)
```

**Reuse summary:**
- Exact reuse: `reasoning_quality_validator`, `final_synthesis`, `open_question_vs_decided`, `reasoning_to_response_faithfulness`, `assumption_citation_validator` (collapsed at this phase, same template).
- Parameter-varied reuse: `contract_schema_enrichment` (different shape), `pass_scope_discipline` (Pass-2 boundary), `source_attribution_grounding` (per-AC anchor surface), `grounding_validator` (claim-set widened to endpoints/codes/error-names).
- **Reused from original assessment at full original scope:** `measurement_adequacy_validator`. This is the centerpiece of this pass; do not narrow.
- New at enrichment: `enrichment_echo_invariance`, `ac_count_discipline`, `exemplar_leakage_detector`, `threshold_grounding_audit`, `measurable_condition_executability`, `skeleton_drift_audit`.
- **Deactivated at enrichment** (active at skeleton, no work here): `story_structural_completeness`, `handoff_coverage_audit`, `story_shape_conformance`. The skeleton fields are echo-protected by `enrichment_echo_invariance` instead.
- Still deactivated (carried forward): `tier_decomposition_validator` (re-engages at FR-saturation / NFR-saturation only).

---

## 4. Validator prompt templates

All LLM validators inherit the revised positive-mission shared envelope from `redesign recommendations - 1.md` §"Revised shared review envelope". Validators reused without modification from the original assessment or from sample 09 are referenced by name, not reproduced.

### 4.1 `contract_schema_enrichment` (deterministic)

Implemented in code. Pseudocode contract:

```
ASSERT response is valid JSON
ASSERT top-level keys exactly == { id, role, action, outcome, priority,
                                   traces_to, acceptance_criteria }
ASSERT no markdown fences, no prose before "{", no prose after "}"
ASSERT no unescaped double quotes inside string values
ASSERT len(acceptance_criteria) between 3 and 10 inclusive
FOR each ac in acceptance_criteria:
  ASSERT ac has exactly { id, description, measurable_condition }
  ASSERT ac.id matches /^AC-\d{3}$/
  ASSERT ac.description and ac.measurable_condition are non-empty strings
  ASSERT ac.id values are unique within the array
```

Severity rule: any failure ⇒ HIGH (Pass-3 verifier will reject).

### 4.2 `enrichment_echo_invariance` (deterministic) — NEW, replaces three skeleton validators

```
LET skeleton  = the input FR skeleton (from prompt's "FR Skeleton" block)
LET response  = the agent's final response

FOR field in { id, role, action, outcome, priority }:
  ASSERT response[field] == skeleton[field]                     (byte-equal)

ASSERT response.traces_to == skeleton.traces_to                 (order-equal)

LET seed_ac = skeleton.acceptance_criteria[0]
ASSERT some ac ∈ response.acceptance_criteria with ac.id == seed_ac.id
       (the seed AC's id is preserved; description/condition MAY be refined)
ASSERT response.acceptance_criteria[*].id are contiguous starting from seed_ac.id

# negative invariants
ASSERT no AC id collides with another FR's AC id range
ASSERT no trace id is added or removed
```

Severity rule: any echo violation on `id|role|action|outcome|priority|traces_to` ⇒ HIGH (the agent has silently re-authored the skeleton); seed-AC-id-missing ⇒ HIGH; non-contiguous AC ids ⇒ MEDIUM.

This validator collapses what was three separate skeleton validators (`story_structural_completeness`, `handoff_coverage_audit`, `story_shape_conformance`) into one cheap echo check, because the enrichment contract is "echo or be flagged."

### 4.3 `ac_count_discipline` (deterministic) — NEW

```
LET n = len(response.acceptance_criteria)
IF n < 3:           emit MEDIUM "under-enriched"   (likely missing failure-mode or boundary)
IF 3 <= n <= 7:     emit nothing                   (target band)
IF 8 <= n <= 10:    emit LOW    "above target band; review for over-fine splits"
IF n > 10:          emit HIGH   "exceeds hard cap"
```

Severity rule as embedded above. Implemented in code; no LLM cost.

### 4.4 `exemplar_leakage_detector` (deterministic) — NEW

```
LET exemplar_block = JSON.parse(prompt.section("# What 'good' looks like" / fallback to embedded ```json``` exemplar))
LET exemplar_strings = collect all measurable_condition and description values from exemplar_block
LET response_strings = collect all measurable_condition and description values from response

FOR (e, r) in exemplar_strings × response_strings:
  IF normalized_levenshtein_similarity(e, r) >= 0.85:
    emit HIGH "exemplar leakage" (e, r)
  ELSE IF longest common substring length(e, r) >= 25 chars:
    emit MEDIUM "exemplar fragment reuse"

# also flag verbatim reuse of exemplar identifiers
LET exemplar_idents = { /properties, ADDRESS_REQUIRED, AC-001..AC-003, US-001 }
FOR token in exemplar_idents:
  IF token appears in response_strings: emit MEDIUM
```

Severity rule as embedded. This validator addresses the §1a.1 defect class from sample 09 (US-001 copying the exemplar's "1 second" condition); it runs at every pass that has an exemplar block in the prompt.

For the present sample this validator returns clean — see §1a.7.

### 4.5 `source_attribution_grounding` (LLM, reused, scope-narrowed)

Reused from sample 09 §4.4, with `[INSPECT]` re-targeted at AC anchors:

```
At enrichment pass, for each acceptance_criterion ac:
  - identify the substrate item(s) that ac.description and ac.measurable_condition
    actually invoke (entity field, workflow step, journey step, compliance item,
    vocabulary term)
  - verify that those substrate items are reachable from the skeleton.traces_to
    set (transitively through journey steps and workflow triggers)
  - flag ACs whose conditions invoke entities, workflows, or journeys that
    the FR does not trace to
```

Severity rule unchanged from sample 09.

### 4.6 `threshold_grounding_audit` (LLM, NEW — specialisation of grounding)

```
[MISSION]
Verify every numeric threshold, time window, cardinality, percentage, and
quantitative bound in the acceptance_criteria array is grounded in the
substrate (skeleton.traces_to items, the FR Skeleton seed AC, traced
workflow steps, traced compliance items, or traced journey acceptance lines).

[INSPECT]
For each ac.measurable_condition:
- extract numeric tokens (regex: /\d+(\.\d+)?\s*(ms|seconds?|minutes?|hours?|days?|%|MB|GB|requests?\/\w+)?/i)
- extract cardinality phrases ("Top N", "first N", "at least N", "exactly N")
- extract HTTP status codes (regex: /HTTP\s+\d{3}/)
- extract named status enum values ('Pending', 'Vetted', 'Rejected', etc.)
- extract error code identifiers (UPPER_SNAKE_CASE near "error code"/"code=")

A threshold is GROUNDED when the same value (modulo unit conversion) appears
in the seed AC, in a traced UJ acceptance line, in a traced workflow step,
in a traced compliance window, or in a traced entity field constraint.

A threshold is UNGROUNDED when the substrate is silent on the value or
names a different value in the same role.

[BOUNDARY]
Description-condition contradictions belong to measurement_adequacy_validator.
Whether the threshold is ADEQUATE belongs there too. This validator only
checks GROUNDING.

[FINDING SHAPE]
{ severity, type: "ungrounded_numeric|ungrounded_cardinality|
                   ungrounded_status_code|ungrounded_error_name|
                   ungrounded_status_enum_value",
  acId, span (quoted), substrateAnchor (or "<none>"),
  recommendation: "remove|surface as assumption|cite the correct anchor" }
```

Severity rule: ungrounded numeric in a binding AC ⇒ HIGH; ungrounded HTTP status code ⇒ MEDIUM (HTTP transport is implementation-coupled); ungrounded error-name string ⇒ MEDIUM; ungrounded sibling-status enum ⇒ MEDIUM.

For this sample, this validator fires HIGH on AC-016's `409`, on AC-016's `'COMPLIANCE_FAILURE'`, and on AC-016's `'Pending'` (see §1a.3).

### 4.7 `grounding_validator` (LLM, reused from original at full scope)

Original assessment §2 template, with `[CLAIMS TO CHECK]` widened for enrichment:

```
At enrichment pass, in addition to the original list, pay attention to:
- REST endpoint paths invented by the agent (no substrate URL is given;
  any path is technically invented — flag only when the path implies a
  capability not in substrate, e.g. a /search or /list endpoint)
- HTTP verbs assigned to journey actions
- Sibling status enum values not present in skeleton.outcome or in
  ENT-* schemas referenced by traces_to (e.g., 'Pending', 'Rejected')
- Error code identifiers
- Internal subsystem names (queues, locks, ACLs) that the substrate does
  not name
```

Severity rule from original; sibling-status grounding failure ⇒ MEDIUM (HIGH if it is the binding pre-state of a rejection AC).

### 4.8 `measurement_adequacy_validator` (LLM, reused from original at FULL ORIGINAL SCOPE)

**Use the original ChatGPT 5.5 template verbatim from `redesign recommendations - 1.md` §3.** Do not paraphrase. Do not narrow. The full `[COMMON DEFECT PATTERNS]` list applies:

> - "100%" requirement verified by "> 0"
> - "every record" verified by count equality without checking nulls or orphan references
> - uniqueness requirement verified by total count
> - existence requirement confused with coverage requirement
> - status alignment requirement without defining the compared populations
> - time-window requirement without timestamps
> - external linkage requirement without referential integrity
> - "critical/high severity" requirement without a severity filter
> - "immutable/audit trail" requirement without append-only or version checks
> - "zero direct traffic" requirement without checking both access logs and network paths
> - a SQL-like condition that is not executable or is semantically ambiguous

Severity rule from original §3 unchanged.

For this sample the validator should fire:
- HIGH on AC-014 (existence-as-coverage; missing referential binding to subject approval; missing lower bound on time window — three of the original eleven patterns simultaneously).
- MEDIUM on AC-015 (post-state confused with transition).
- MEDIUM on AC-017 (weak proxy: field-existence without value comparator) and (non-executable: ambiguous `{id}` join key).
- MEDIUM on AC-016 (status-alignment without defined population — what defines "compliance failure" populationally?).

This is the validator most overdue for re-introduction; sample 09 explicitly deferred it here.

### 4.9 `measurable_condition_executability` (LLM, NEW — narrow companion to measurement adequacy)

```
[MISSION]
Verify that each measurable_condition could be turned into a runnable
assertion by a QA engineer or test author without inventing missing
variables, join keys, or schema details.

[INSPECT]
For each ac.measurable_condition:
- Are all referenced symbolic names (column names, path parameters,
  query keys, response field names) either grounded in substrate or
  named consistently across the AC?
- Is every path parameter ({id}, {name}) bound to a specific subject?
  (e.g., "GET /vetting-decisions/{id}" — which id? a vendor's? an
  approval's? an audit log's?)
- Is the assertion a complete predicate, or does it terminate with a
  field name with no comparator?
  (e.g., "returns record with decision_type='approved' and vendor_id"
  — vendor_id with no value to compare is incomplete)
- Are units consistent (seconds vs ms vs minutes)?

[BOUNDARY]
Whether the executable assertion adequately verifies the description
belongs to measurement_adequacy_validator. This validator only asks:
"could a QA engineer write this test from this string alone?"

[FINDING SHAPE]
{ severity, type: "ambiguous_path_param|incomplete_predicate|
                   undefined_symbol|inconsistent_unit",
  acId, span, recommendation }
```

Severity rule: incomplete predicate / undefined symbol ⇒ MEDIUM; ambiguous path param ⇒ MEDIUM; inconsistent unit ⇒ LOW.

This overlaps `measurement_adequacy_validator` on the "non-executable / ambiguous" patterns by design. Run both; let `final_synthesis` deduplicate. The overlap is intentional because the two validators read the AC at different abstraction levels and one rarely catches both classes consistently.

### 4.10 `skeleton_drift_audit` (LLM, NEW)

```
[MISSION]
Verify that the enriched acceptance_criteria stay within the user-facing
capability promised by the input skeleton's role / action / outcome triple
and the items in skeleton.traces_to.

[INSPECT]
For each ac:
- Does ac's described capability fall inside the skeleton's outcome's
  scope? (For US-014 outcome "Vendor status updated to 'Vetted' for
  community use", the verification surface is the status-update event
  itself, the audit-log obligation around it, and the persisted decision
  record. Listing/searching vendors by status is a separable capability
  that belongs to a different FR.)
- Does ac introduce a substrate item not in skeleton.traces_to?
- Does ac re-author the role/action/outcome by implication (e.g., an
  AC whose subject is a different persona)?

[FAILURE PATTERNS]
- search/listing capability bolted onto a status-update FR
- reporting/analytics capability bolted onto a transactional FR
- access-control capability bolted onto a non-AuthZ FR
- AC implies an actor not in skeleton.role

[BOUNDARY]
Grounding of new symbols belongs to grounding_validator. This validator
only judges whether the ENRICHED CAPABILITY remains the SKELETON's capability.

[FINDING SHAPE]
{ severity, type: "out_of_scope_capability|implicit_role_drift|
                   substrate_widening",
  acId, span, skeletonAnchor, recommendation:
  "remove|move to a separate FR|narrow to skeleton scope" }
```

Severity rule: out-of-scope capability ⇒ MEDIUM (HIGH if it implies a new persona / authorisation surface); substrate widening ⇒ MEDIUM; implicit role drift ⇒ HIGH (re-authors the skeleton).

For this sample, fires MEDIUM on AC-018.

### 4.11 `pass_scope_discipline` (LLM, reused, parameter-varied)

Sample 09 §4.6 template, with `[INSPECT]` retargeted for Pass 2:

```
At enrichment pass, the boundary moves:
- ACs MAY include precise HTTP status codes, comparators, multi-clause
  predicates, full state assertions — that is the point of this pass.
- ACs MUST NOT introduce NFR thresholds (latency budgets, throughput,
  uptime). Those belong to Sub-Phase 2.2.
- ACs MUST NOT introduce trace ids beyond skeleton.traces_to.
- ACs MUST NOT exceed 10 entries (hard cap; soft band 3–7).

[INSPECT]
- numeric thresholds: is the threshold a functional commitment
  (deadline, retention window, cardinality) or an NFR (ms-latency,
  rps)? NFR thresholds are out of scope for this pass.
- references to internal subsystems (queues, ACLs, caches) that
  prematurely bind implementation.
```

Severity rule: NFR threshold in an AC ⇒ MEDIUM; new trace id introduced ⇒ HIGH (caught by `enrichment_echo_invariance` first; this is the LLM-side cross-check); premature implementation binding ⇒ LOW.

### 4.12 `assumption_citation_validator` (LLM, reused, collapsed to trace-only)

Same as sample 09 §4.9. Mission: verify every `traces_to[]` entry resolves to a real handoff id and is non-duplicative within the FR. The enrichment contract has no `surfaced_assumptions[]` either, so the citation half remains the only active half. Severity rule unchanged.

### 4.13 `reasoning_to_response_faithfulness` (LLM, reused)

Same template as sample 09 §4.10. At enrichment pass, expect this validator to fire on:
- The agent commits in the chain to producing N ACs and emits M ≠ N (sample 09 had US-028/029/030 dropped; here the chain wavers between 4 and 6 ACs many times before settling on 5 — not a defect since the last decision matches the output, but the validator should still confirm).
- The agent identifies a defect in the chain ("Wait, that's vague…") and emits the unfixed version anyway.

For this sample, this validator should NOT fire materially: the chain's last revision and the output align. The chain's pathological length is a `reasoning_quality_validator` concern, not a faithfulness concern.

### 4.14 `open_question_vs_decided` (LLM, reused)

Sample 09 §4.11 template. At enrichment, additionally: an AC whose `measurable_condition` binds a value that the prompt treats as an open question (e.g., a Q-* in `traces_to`) must surface that anchoring, not silently commit to a default.

### 4.15 `reasoning_quality_validator` (LLM, reused unchanged)

Original §6 template. At enrichment, the cost-of-thought signal should be added to the validator's attention surface: a 41× reasoning-to-response ratio (as observed here) is a `over-cleverness / shortcut-taking` signal worth a LOW finding when accompanied by other defects, and a MEDIUM finding when the chain repeatedly catches the same defect without fixing it.

### 4.16 `final_synthesis` (LLM, reused unchanged)

Original §7 template. Decision policy:
- Any HIGH from `contract_schema_enrichment`, `enrichment_echo_invariance`, `ac_count_discipline` (>10 case), `exemplar_leakage_detector`, `grounding_validator`, `threshold_grounding_audit`, or `measurement_adequacy_validator` ⇒ QUARANTINE.
- HIGH from `skeleton_drift_audit` (implicit role drift case) ⇒ QUARANTINE.
- MEDIUM-only with no HIGHs ⇒ REVISE.
- LOW-only ⇒ ACCEPT_WITH_NOTES.

For this sample, the synthesis output should be QUARANTINE on the basis of three independent HIGH findings (AC-014 measurement adequacy + AC-016 threshold grounding × 3 separate ungrounded values).

---

## 5. Conditional dispatch and integration

**Always-run (deterministic, near-zero cost):**
- `contract_schema_enrichment`
- `enrichment_echo_invariance`
- `ac_count_discipline`
- `exemplar_leakage_detector`

If `contract_schema_enrichment` or `enrichment_echo_invariance` fires HIGH, short-circuit to `final_synthesis` — running LLM validators against an off-contract response wastes budget.

**Always-run (LLM, narrow):**
- `measurement_adequacy_validator` (the centerpiece — never skip)
- `threshold_grounding_audit`
- `measurable_condition_executability`
- `skeleton_drift_audit`
- `reasoning_to_response_faithfulness`

These are the validators the corpus has shown a single broad reviewer cannot cover.

**Conditional:**
- `grounding_validator` runs only if response contains tokens matching the regex pre-filter `/HTTP\s+\d{3}|[A-Z_]{4,}|GET|POST|PUT|DELETE|status\s*=\s*'[A-Za-z]+'/`. For this sample (`HTTP 409`, `COMPLIANCE_FAILURE`, `status='Vetted'`, REST verbs) it dispatches.
- `source_attribution_grounding` runs if any AC names an entity, workflow, or journey id explicitly in the condition string (regex: `/\b(UJ|ENT|WF|COMP)-[A-Z0-9-]+\b/`). For this sample, none of the ACs do — they reference substrate semantically, not by id — so this validator may be skipped or run advisory-only.
- `pass_scope_discipline` runs if regex pre-filter detects ms/seconds-level latency or named subsystem tokens.
- `open_question_vs_decided` runs if any `Q-*` or `OPEN-*` id is in `traces_to` (none for this sample).

**Synthesis:** `final_synthesis` always last. Same policy as sample 09 with the additions in §4.16.

**Cost note:** the four deterministic validators eliminate the schema/echo/count/leakage axes for free. The five always-run LLM validators each have small input scope (one FR, ~1.5 KB response, plus the relevant substrate excerpt — typically < 8 KB of context per call) and can run on a Gemma-class reviewer in serial. The `measurement_adequacy_validator` is the only one that benefits materially from a stronger model (qwen3.5:9b or larger); if budget allows, route only that one to a higher-capacity reviewer.

---

## 6. Notes and open questions

1. **Original ChatGPT 5.5 template is the canonical text for `measurement_adequacy_validator` at this pass.** Use it verbatim. Sample 09's narrowed variant exists *only* because skeleton's seed-AC is a placeholder; that narrowing is not a Pass-2 design choice. Re-paraphrasing the template in code review or in implementation will erode the validator's signal.

2. **Echo-invariance subsumes three skeleton validators.** Once the contract guarantees "echo or violate," the three skeleton-shape validators (`story_structural_completeness`, `handoff_coverage_audit`, `story_shape_conformance`) have no work at this pass that a single equality check doesn't cover. Implementation-wise, the simplest form is `assert_deep_equal(input_skeleton.except('acceptance_criteria'), response.except('acceptance_criteria'))` plus a seed-AC-id retention check.

3. **Pass-3 (deterministic verifier) overlap.** The prompt promises a Pass-3 deterministic verifier downstream. Wherever that verifier and the validators here would compute the same thing (e.g., AC count discipline, AC id contiguity, echo invariance), prefer running those checks at this advisory pass too — catching defects one pass earlier is strictly cheaper, and Pass-3 then becomes a confirmation gate rather than the only gate.

4. **`measurable_condition_executability` ↔ `measurement_adequacy_validator` overlap.** Deliberate. The two validators read the same string at different abstraction levels: executability asks "can I write a test from this?", adequacy asks "would the test verify the description?" Empirically, single-pass reviewers conflate the two and miss one or the other. Running both and letting `final_synthesis` deduplicate is the cheapest reliable shape.

5. **Reasoning-chain pathology cost.** The 41× thinking-to-response ratio observed here (~60 KB chain for 1.4 KB output) is a Gemma-tier failure mode of its own — the agent self-loops on constraint restatement. It is not a *correctness* defect of the response and so is reported here only at LOW. But it is a *cost* defect worth surfacing in pipeline observability: a sub-phase where the median chain length exceeds 10× the response length should trigger a thinking-budget review, not a per-output review.

6. **Negative findings are evidence too.** §1a.7 (no exemplar leakage) is a real positive signal: sample 09's US-001 exemplar-leakage defect did *not* propagate. The deterministic `exemplar_leakage_detector` should record that as a clean pass and the data point should feed back into the skeleton-pass remediation tracking — i.e., whatever changed between Pass 1 and Pass 2 in the prompt or the agent's behaviour appears to have closed that specific defect class.

7. **Sibling status enum values are an under-recognised grounding surface.** AC-016's `'Pending'` is technically a single-word string, but it is a *binding pre-state* on the rejection AC — it commits the platform to a vendor-state machine that nothing in substrate has authorised. `threshold_grounding_audit`'s "ungrounded_status_enum_value" finding type is specifically for this class; without it, a single-word grounding defect of substantial blast radius gets lost in the validator pipeline because it doesn't match a numeric or HTTP regex.

8. **Deferred to a downstream pass:** the count-equality / set-equality / null-handling battery from the original assessment is *active* at this pass on FR-style ACs (state assertions, log existence, decision records), but its full strength engages on **NFR saturation** at Sub-Phase 2.2 where SQL-shaped measurable conditions become the dominant form. Carry forward unchanged.
